import { Injectable } from '@nestjs/common';
import type { WebPushSubscription } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface UpsertSubscriptionData {
  userId: string;
  householdId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string | null;
}

@Injectable()
export class PushSubscriptionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByUserId(userId: string): Promise<WebPushSubscription[]> {
    return this.prisma.webPushSubscription.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  findOwnedById(id: string, userId: string): Promise<WebPushSubscription | null> {
    return this.prisma.webPushSubscription.findFirst({ where: { id, userId } });
  }

  /**
   * Endpoint is the natural unique key (push services reuse endpoints
   * across browser sessions on the same device). We upsert so that
   * re-subscription updates the keys + userAgent rather than piling up
   * duplicate rows.
   */
  upsert(data: UpsertSubscriptionData): Promise<WebPushSubscription> {
    return this.prisma.webPushSubscription.upsert({
      where: { endpoint: data.endpoint },
      create: {
        userId: data.userId,
        householdId: data.householdId,
        endpoint: data.endpoint,
        p256dh: data.p256dh,
        auth: data.auth,
        userAgent: data.userAgent ?? null,
      },
      update: {
        userId: data.userId,
        householdId: data.householdId,
        p256dh: data.p256dh,
        auth: data.auth,
        userAgent: data.userAgent ?? null,
        lastSeenAt: new Date(),
      },
    });
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const res = await this.prisma.webPushSubscription.deleteMany({
      where: { id, userId },
    });
    return res.count > 0;
  }

  async deleteByEndpoint(endpoint: string): Promise<void> {
    await this.prisma.webPushSubscription.deleteMany({ where: { endpoint } });
  }

  async touchLastSeen(id: string): Promise<void> {
    await this.prisma.webPushSubscription.update({
      where: { id },
      data: { lastSeenAt: new Date() },
    });
  }
}
