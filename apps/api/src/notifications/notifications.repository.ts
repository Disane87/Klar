import { Injectable } from '@nestjs/common';
import type { Notification, NotificationKind, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateNotificationData {
  householdId: string;
  userId?: string | null;
  kind: NotificationKind;
  title: string;
  body?: string | null;
  payloadJson?: Prisma.InputJsonValue | null;
}

export interface FindAllOpts {
  /** Cursor (id of last item from previous page). */
  cursor?: string;
  /** Page size. Defaults to 20. */
  limit?: number;
  /** Restrict to current user (excludes other-user-only notifications). */
  userId?: string;
  /** When true, only unread items. */
  unreadOnly?: boolean;
}

@Injectable()
export class NotificationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll(householdId: string, opts: FindAllOpts = {}): Promise<Notification[]> {
    const limit = Math.min(Math.max(opts.limit ?? 20, 1), 100);
    const userFilter = opts.userId
      ? { OR: [{ userId: null }, { userId: opts.userId }] }
      : {};

    return this.prisma.notification.findMany({
      where: {
        householdId,
        ...userFilter,
        ...(opts.unreadOnly ? { readAt: null } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1, // peek one ahead for next-cursor
      ...(opts.cursor
        ? { cursor: { id: opts.cursor }, skip: 1 }
        : {}),
    });
  }

  findById(id: string, householdId: string): Promise<Notification | null> {
    return this.prisma.notification.findFirst({ where: { id, householdId } });
  }

  create(data: CreateNotificationData): Promise<Notification> {
    return this.prisma.notification.create({
      data: {
        householdId: data.householdId,
        userId: data.userId ?? null,
        kind: data.kind,
        title: data.title,
        body: data.body ?? null,
        ...(data.payloadJson !== undefined && data.payloadJson !== null
          ? { payloadJson: data.payloadJson }
          : {}),
      },
    });
  }

  markRead(id: string, householdId: string): Promise<Prisma.BatchPayload> {
    return this.prisma.notification.updateMany({
      where: { id, householdId, readAt: null },
      data: { readAt: new Date() },
    });
  }

  markAllRead(householdId: string, userId: string): Promise<Prisma.BatchPayload> {
    return this.prisma.notification.updateMany({
      where: {
        householdId,
        readAt: null,
        OR: [{ userId: null }, { userId }],
      },
      data: { readAt: new Date() },
    });
  }

  async delete(id: string, householdId: string): Promise<void> {
    await this.prisma.notification.deleteMany({ where: { id, householdId } });
  }

  countUnread(householdId: string, userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: {
        householdId,
        readAt: null,
        OR: [{ userId: null }, { userId }],
      },
    });
  }
}
