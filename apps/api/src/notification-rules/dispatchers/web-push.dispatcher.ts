import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import webPush, { type WebPushError } from 'web-push';
import { PushSubscriptionsRepository } from '../push-subscriptions/push-subscriptions.repository';

export interface WebPushPayload {
  title: string;
  body: string;
  /** Deep-link URL opened on notification click. */
  url: string;
  /** Replaces any previous push with the same tag (single notification per rule). */
  tag: string;
  /** Foreign key into the Notification table so click-through can mark it read. */
  notificationId: string | null;
  icon?: string;
  badge?: string;
}

/**
 * Web Push delivery via RFC 8030/8291. Dispatches to all of a user's
 * registered subscriptions in parallel and reaps gone (404 / 410)
 * endpoints automatically. Soft-fails if VAPID isn't configured so that
 * an in-app dispatch is never blocked by missing push config.
 */
@Injectable()
export class WebPushDispatcher implements OnModuleInit {
  private readonly logger = new Logger(WebPushDispatcher.name);
  private configured = false;

  constructor(
    private readonly config: ConfigService,
    private readonly subs: PushSubscriptionsRepository,
  ) {}

  onModuleInit(): void {
    const publicKey = this.config.get<string>('webPush.publicKey');
    const privateKey = this.config.get<string>('webPush.privateKey');
    const subject = this.config.get<string>('webPush.subject');
    if (!publicKey || !privateKey || !subject) {
      this.logger.warn(
        'VAPID keys missing — WEB_PUSH channel will be a no-op until VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT are set (run `pnpm --filter @klar/api vapid:generate`).',
      );
      return;
    }
    webPush.setVapidDetails(subject, publicKey, privateKey);
    this.configured = true;
  }

  isConfigured(): boolean {
    return this.configured;
  }

  /**
   * Fan-out to every subscription the user has. Gone subscriptions are
   * deleted on the spot. Returns the count of attempted endpoints (not
   * delivered — push services are async).
   */
  async send(userId: string, payload: WebPushPayload): Promise<number> {
    if (!this.configured) return 0;
    const subscriptions = await this.subs.findByUserId(userId);
    if (subscriptions.length === 0) return 0;

    await Promise.all(
      subscriptions.map(async sub => {
        try {
          await webPush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            JSON.stringify(payload),
            { TTL: 86_400 },
          );
          await this.subs.touchLastSeen(sub.id);
        } catch (err) {
          const status = (err as WebPushError).statusCode;
          if (status === 404 || status === 410) {
            await this.subs.deleteByEndpoint(sub.endpoint);
            this.logger.debug({ subId: sub.id, status }, 'reaped gone push subscription');
            return;
          }
          this.logger.warn(
            { err, subId: sub.id, status },
            'Web push delivery failed',
          );
        }
      }),
    );
    return subscriptions.length;
  }
}
