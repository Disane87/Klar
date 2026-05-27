import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { WebPushSubscription } from '@prisma/client';
import type { RequestContext } from '../../common/types/request-context.type';
import { PushSubscriptionsRepository } from './push-subscriptions.repository';
import type { SubscribePushDto } from './dto/subscribe-push.dto';

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

  subscribe(ctx: RequestContext, dto: SubscribePushDto): Promise<WebPushSubscription> {
    return this.repo.upsert({
      userId: ctx.userId,
      householdId: ctx.householdId,
      endpoint: dto.endpoint,
      p256dh: dto.keys.p256dh,
      auth: dto.keys.auth,
      userAgent: dto.userAgent ?? null,
    });
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
