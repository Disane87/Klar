import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { WebPushSubscription } from '@prisma/client';
import type { RequestContext } from '../../common/types/request-context.type';
import { PushSubscriptionsRepository } from './push-subscriptions.repository';
import type { SubscribePushDto } from './dto/subscribe-push.dto';

/**
 * Hostnames allowed for Web Push endpoints. Drawn from each vendor's
 * documented push gateway domains; missing a host here means a user can't
 * subscribe via that browser/vendor — easier to add than to debug SSRF.
 */
const ALLOWED_PUSH_HOST_SUFFIXES = [
  'push.services.mozilla.com',   // Firefox
  'fcm.googleapis.com',          // Chrome / Edge desktop
  'updates.push.services.mozilla.com',
  'web.push.apple.com',          // Safari (iOS PWA)
  'wns2-apse1p.notify.windows.com',
  'wns2-bn3p.notify.windows.com',
  'wns2-by3p.notify.windows.com',
  'wns2-co4p.notify.windows.com',
  'wns2-db3p.notify.windows.com',
  'wns2-pn1p.notify.windows.com',
  'wns2-sn1p.notify.windows.com',
  'notify.windows.com',          // WNS catch-all
];

function isAllowedPushHost(hostname: string): boolean {
  const lower = hostname.toLowerCase().replace(/\.$/, '');
  return ALLOWED_PUSH_HOST_SUFFIXES.some(
    suffix => lower === suffix || lower.endsWith(`.${suffix}`),
  );
}

@Injectable()
export class PushSubscriptionsService {
  constructor(
    private readonly repo: PushSubscriptionsRepository,
    private readonly config: ConfigService,
  ) {}

  /**
   * Returns the configured VAPID public key, or empty when the deployment
   * has none — frontend uses the empty string to gate the toggle.
   */
  vapidPublicKey(): string {
    return this.config.get<string>('webPush.publicKey') ?? '';
  }

  list(ctx: RequestContext): Promise<WebPushSubscription[]> {
    return this.repo.findByUserId(ctx.userId);
  }

  async subscribe(ctx: RequestContext, dto: SubscribePushDto): Promise<WebPushSubscription> {
    this.assertAllowedPushEndpoint(dto.endpoint);
    return this.repo.upsert({
      userId: ctx.userId,
      householdId: ctx.householdId,
      endpoint: dto.endpoint,
      p256dh: dto.keys.p256dh,
      auth: dto.keys.auth,
      userAgent: dto.userAgent ?? null,
    });
  }

  /**
   * SSRF guard: only accept push-service endpoints from the major browser
   * vendors. Without this, a malicious user could submit an internal URL
   * (e.g. http://192.168.0.5/admin) and the WebPushDispatcher would POST
   * to it on every rule fire.
   */
  private assertAllowedPushEndpoint(endpoint: string): void {
    let url: URL;
    try {
      url = new URL(endpoint);
    } catch {
      throw new BadRequestException('endpoint ist keine gültige URL');
    }
    if (url.protocol !== 'https:') {
      throw new BadRequestException('endpoint muss https sein');
    }
    if (!isAllowedPushHost(url.hostname)) {
      throw new BadRequestException(
        'endpoint stammt nicht von einem bekannten Push-Service',
      );
    }
  }

  async remove(ctx: RequestContext, id: string): Promise<void> {
    const ok = await this.repo.delete(id, ctx.userId);
    if (!ok) throw new NotFoundException(`Push-Subscription ${id} nicht gefunden`);
  }

  toResponse(sub: WebPushSubscription) {
    return {
      id: sub.id,
      endpoint: sub.endpoint,
      userAgent: sub.userAgent,
      createdAt: sub.createdAt.toISOString(),
      lastSeenAt: sub.lastSeenAt.toISOString(),
    };
  }
}
