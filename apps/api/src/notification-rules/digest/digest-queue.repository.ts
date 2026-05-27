import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { NotificationChannel, NotificationDigestQueue } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface EnqueueDigestData {
  userId: string;
  channel: NotificationChannel;
  ruleId: string;
  bucketKey: string;
  payload: Prisma.InputJsonValue;
}

@Injectable()
export class DigestQueueRepository {
  constructor(private readonly prisma: PrismaService) {}

  enqueue(data: EnqueueDigestData): Promise<NotificationDigestQueue> {
    return this.prisma.notificationDigestQueue.create({
      data: {
        userId: data.userId,
        channel: data.channel,
        ruleId: data.ruleId,
        bucketKey: data.bucketKey,
        payloadJson: data.payload,
      },
    });
  }

  findReady(bucketPrefix: string): Promise<NotificationDigestQueue[]> {
    return this.prisma.notificationDigestQueue.findMany({
      where: { bucketKey: { startsWith: bucketPrefix } },
      orderBy: [{ userId: 'asc' }, { channel: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async deleteIds(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.prisma.notificationDigestQueue.deleteMany({
      where: { id: { in: ids } },
    });
  }
}

/**
 * Compose the bucketKey for the digest queue.
 *
 * Format:
 * - hourly: `hour:YYYY-MM-DDTHH` (UTC)
 * - daily:  `day:YYYY-MM-DD` (UTC)
 *
 * The flush cron looks up rows where bucketKey starts with `hour:` (resp.
 * `day:`) and bucketKey < current bucket — i.e. anything pending from a
 * previous bucket flushes now.
 */
export function digestBucketKey(
  mode: 'HOURLY' | 'DAILY',
  at: Date = new Date(),
): string {
  const y = at.getUTCFullYear();
  const m = String(at.getUTCMonth() + 1).padStart(2, '0');
  const d = String(at.getUTCDate()).padStart(2, '0');
  if (mode === 'DAILY') return `day:${y}-${m}-${d}`;
  const h = String(at.getUTCHours()).padStart(2, '0');
  return `hour:${y}-${m}-${d}T${h}`;
}
