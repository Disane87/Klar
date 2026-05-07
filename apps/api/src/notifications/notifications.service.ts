import { Injectable, NotFoundException } from '@nestjs/common';
import type { Notification, NotificationKind, Prisma } from '@prisma/client';
import type { RequestContext } from '../common/types/request-context.type';
import {
  NotificationsRepository,
  type CreateNotificationData,
  type FindAllOpts,
} from './notifications.repository';

export interface ListNotificationsOpts {
  cursor?: string;
  limit?: number;
  unreadOnly?: boolean;
}

export interface NotificationListResponse {
  items: ReturnType<NotificationsService['toResponse']>[];
  nextCursor: string | null;
  unreadCount: number;
}

export interface EnqueueOptions {
  /** Override target user. Default: undefined → derived from ctx (null = household-wide). */
  userId?: string | null;
  body?: string | null;
  payloadJson?: Prisma.InputJsonValue | null;
}

@Injectable()
export class NotificationsService {
  constructor(private readonly repo: NotificationsRepository) {}

  async list(
    ctx: RequestContext,
    opts: ListNotificationsOpts = {},
  ): Promise<NotificationListResponse> {
    const limit = Math.min(Math.max(opts.limit ?? 20, 1), 100);
    const repoOpts: FindAllOpts = {
      cursor: opts.cursor,
      limit,
      userId: ctx.userId,
      unreadOnly: opts.unreadOnly,
    };
    const rows = await this.repo.findAll(ctx.householdId, repoOpts);

    let nextCursor: string | null = null;
    let items = rows;
    if (rows.length > limit) {
      items = rows.slice(0, limit);
      nextCursor = items[items.length - 1].id;
    }

    const unreadCount = await this.repo.countUnread(ctx.householdId, ctx.userId);

    return {
      items: items.map(n => this.toResponse(n)),
      nextCursor,
      unreadCount,
    };
  }

  async markRead(ctx: RequestContext, id: string): Promise<void> {
    const existing = await this.repo.findById(id, ctx.householdId);
    if (!existing) throw new NotFoundException(`Notification ${id} nicht gefunden`);
    await this.repo.markRead(id, ctx.householdId);
  }

  async markAllRead(ctx: RequestContext): Promise<{ updated: number }> {
    const result = await this.repo.markAllRead(ctx.householdId, ctx.userId);
    return { updated: result.count };
  }

  async remove(ctx: RequestContext, id: string): Promise<void> {
    const existing = await this.repo.findById(id, ctx.householdId);
    if (!existing) throw new NotFoundException(`Notification ${id} nicht gefunden`);
    await this.repo.delete(id, ctx.householdId);
  }

  /**
   * Internal trigger used by other modules (contracts, csv-import, budgets, …).
   * `userId` may be `null` (household-wide), an explicit string, or undefined → ctx.userId.
   */
  async enqueue(
    ctx: RequestContext,
    kind: NotificationKind,
    title: string,
    options: EnqueueOptions = {},
  ): Promise<Notification> {
    const data: CreateNotificationData = {
      householdId: ctx.householdId,
      userId: options.userId === undefined ? ctx.userId : options.userId,
      kind,
      title,
      body: options.body ?? null,
      payloadJson: options.payloadJson ?? null,
    };
    return this.repo.create(data);
  }

  toResponse(n: Notification) {
    return {
      id: n.id,
      householdId: n.householdId,
      userId: n.userId,
      kind: n.kind,
      title: n.title,
      body: n.body,
      payloadJson: n.payloadJson,
      readAt: n.readAt ? n.readAt.toISOString() : null,
      createdAt: n.createdAt.toISOString(),
    };
  }
}
