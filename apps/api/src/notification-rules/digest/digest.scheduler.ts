import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { NotificationChannel, NotificationDigestQueue } from '@prisma/client';
import {
  DigestQueueRepository,
  digestBucketKey,
} from './digest-queue.repository';
import { EmailDispatcher, type DigestGroup } from '../dispatchers/email.dispatcher';
import { WebPushDispatcher } from '../dispatchers/web-push.dispatcher';
import { NotificationRulesRepository } from '../notification-rules.repository';

type QueuedDigest = NotificationDigestQueue;

/**
 * Flushes queued digests on two crons:
 *   - every full hour for `bucketKey LIKE 'hour:*'`
 *   - every day at 08:00 for `bucketKey LIKE 'day:*'`
 *
 * Rows are grouped by (userId, channel) so each user gets at most one
 * email and one push per flush — bulk events from a CSV import don't
 * fan out into 50 separate notifications.
 */
@Injectable()
export class DigestScheduler {
  private readonly logger = new Logger(DigestScheduler.name);

  constructor(
    private readonly queue: DigestQueueRepository,
    private readonly email: EmailDispatcher,
    private readonly webPush: WebPushDispatcher,
    private readonly rules: NotificationRulesRepository,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async flushHourly(): Promise<void> {
    await this.flush('HOURLY', 'hour:');
  }

  @Cron('0 8 * * *')
  async flushDaily(): Promise<void> {
    await this.flush('DAILY', 'day:');
  }

  private async flush(mode: 'HOURLY' | 'DAILY', prefix: string): Promise<void> {
    const rows = (await this.queue.findReady(prefix)) as QueuedDigest[];
    // Drop the current bucket — only flush previous buckets so we don't
    // race against in-flight enqueues.
    const currentBucket = digestBucketKey(mode);
    const ready = rows.filter(r => r.bucketKey !== currentBucket);
    if (ready.length === 0) return;

    this.logger.log(`digest flush ${mode}: ${ready.length} queued items`);

    const byUserChannel = new Map<string, QueuedDigest[]>();
    for (const row of ready) {
      const key = `${row.userId}|${row.channel}`;
      const list = byUserChannel.get(key);
      if (list) list.push(row);
      else byUserChannel.set(key, [row]);
    }

    const flushedIds: string[] = [];
    for (const [key, items] of byUserChannel.entries()) {
      const [userId, channel] = key.split('|') as [string, NotificationChannel];
      try {
        await this.dispatchGroup(userId, channel, items, mode);
        flushedIds.push(...items.map(i => i.id));
      } catch (err) {
        this.logger.warn({ err, userId, channel }, 'digest flush group failed');
      }
    }
    await this.queue.deleteIds(flushedIds);
  }

  private async dispatchGroup(
    userId: string,
    channel: NotificationChannel,
    items: QueuedDigest[],
    mode: 'HOURLY' | 'DAILY',
  ): Promise<void> {
    if (channel === 'EMAIL') {
      const groups = await this.composeGroupsForEmail(items);
      await this.email.sendDigest(userId, mode, groups);
      return;
    }
    if (channel === 'WEB_PUSH') {
      // Web Push has a small payload budget — send a single summary push.
      if (!this.webPush.isConfigured()) return;
      const count = items.length;
      await this.webPush.send(userId, {
        title: 'Klar',
        body: `${count} neue Hinweise (${mode === 'HOURLY' ? 'Stunde' : 'Tag'})`,
        url: '/app/settings/notifications',
        tag: `digest:${mode.toLowerCase()}`,
        notificationId: null,
      });
      return;
    }
    // IN_APP digests are not produced — IN_APP always fires immediately.
  }

  private async composeGroupsForEmail(items: QueuedDigest[]): Promise<DigestGroup[]> {
    const byRule = new Map<string, QueuedDigest[]>();
    for (const item of items) {
      const list = byRule.get(item.ruleId);
      if (list) list.push(item);
      else byRule.set(item.ruleId, [item]);
    }
    const groups: DigestGroup[] = [];
    for (const [ruleId, group] of byRule.entries()) {
      const rule = await this.rules.findByIdAny(ruleId);
      const lines = group
        .map(g => this.payloadLine(g.payloadJson))
        .filter((s): s is string => !!s);
      groups.push({
        ruleName: rule?.name ?? 'Regel',
        items: lines,
      });
    }
    return groups;
  }

  private payloadLine(payload: unknown): string | null {
    if (!payload || typeof payload !== 'object') return null;
    const p = payload as Record<string, unknown>;
    if (typeof p['body'] === 'string' && p['body']) return p['body'];
    if (typeof p['title'] === 'string' && p['title']) return p['title'];
    return null;
  }
}
