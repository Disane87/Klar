import { Injectable } from '@nestjs/common';
import type { NotificationRule } from '@prisma/client';
import type { RequestContext } from '../../common/types/request-context.type';
import { NotificationsService } from '../../notifications/notifications.service';

export interface InAppDispatchInput {
  rule: NotificationRule;
  title: string;
  body?: string | null;
  payload?: Record<string, unknown>;
}

/**
 * In-app dispatcher: writes a row into the existing Notification table.
 * The rules engine wraps every channel behind a uniform dispatch API so
 * future channels (web push, email, digest) plug in symmetrically.
 */
@Injectable()
export class InAppDispatcher {
  constructor(private readonly notifications: NotificationsService) {}

  async dispatch(input: InAppDispatchInput): Promise<string> {
    const ctx: RequestContext = {
      householdId: input.rule.householdId,
      userId: input.rule.userId,
      source: 'web',
    };
    const notification = await this.notifications.enqueue(ctx, 'SYSTEM', input.title, {
      userId: input.rule.userId,
      body: input.body ?? null,
      payloadJson: input.payload
        ? { ruleId: input.rule.id, ...input.payload }
        : { ruleId: input.rule.id },
    });
    return notification.id;
  }
}
