import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NotificationDigestQueue, NotificationRule } from '@prisma/client';
import { DigestScheduler } from './digest.scheduler';
import {
  digestBucketKey,
  type DigestQueueRepository,
} from './digest-queue.repository';
import type { EmailDispatcher } from '../dispatchers/email.dispatcher';
import type { WebPushDispatcher } from '../dispatchers/web-push.dispatcher';
import type { NotificationRulesRepository } from '../notification-rules.repository';

function makeQueued(over: Partial<NotificationDigestQueue> = {}): NotificationDigestQueue {
  return {
    id: 'dq_1',
    userId: 'usr_1',
    householdId: 'hh_1',
    channel: 'EMAIL',
    ruleId: 'nrl_1',
    bucketKey: 'hour:2026-05-08T10',
    payloadJson: { body: '+250,00 €', title: 'Großer Eingang' },
    createdAt: new Date('2026-05-08T10:30:00Z'),
    ...over,
  } as NotificationDigestQueue;
}

function makeRule(over: Partial<NotificationRule> = {}): NotificationRule {
  return {
    id: 'nrl_1',
    name: 'Großer Eingang',
  } as NotificationRule & typeof over;
}

function buildScheduler() {
  const queue = {
    findReady: vi.fn(),
    deleteIds: vi.fn().mockResolvedValue(undefined),
  } as unknown as DigestQueueRepository;
  const email = {
    sendDigest: vi.fn().mockResolvedValue(true),
  } as unknown as EmailDispatcher;
  const webPush = {
    isConfigured: vi.fn().mockReturnValue(false),
    send: vi.fn().mockResolvedValue(0),
  } as unknown as WebPushDispatcher;
  const rules = {
    findByIdAny: vi.fn().mockResolvedValue(makeRule()),
  } as unknown as NotificationRulesRepository;
  return {
    scheduler: new DigestScheduler(queue, email, webPush, rules),
    queue,
    email,
    webPush,
    rules,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('digestBucketKey', () => {
  it('produces hour:YYYY-MM-DDTHH for hourly mode', () => {
    const key = digestBucketKey('HOURLY', new Date(Date.UTC(2026, 4, 8, 14, 45)));
    expect(key).toBe('hour:2026-05-08T14');
  });

  it('produces day:YYYY-MM-DD for daily mode', () => {
    const key = digestBucketKey('DAILY', new Date(Date.UTC(2026, 4, 8, 14, 45)));
    expect(key).toBe('day:2026-05-08');
  });
});

describe('DigestScheduler.flushHourly', () => {
  it('groups by (userId, channel) and sends one email per group', async () => {
    const { scheduler, queue, email } = buildScheduler();
    vi.mocked(queue.findReady).mockResolvedValue([
      makeQueued({ id: 'd1', bucketKey: 'hour:2026-05-08T09' }),
      makeQueued({ id: 'd2', bucketKey: 'hour:2026-05-08T09', payloadJson: { body: 'Item 2' } as never }),
    ]);
    await scheduler.flushHourly();
    expect(email.sendDigest).toHaveBeenCalledTimes(1);
    expect(email.sendDigest).toHaveBeenCalledWith(
      'usr_1',
      'HOURLY',
      expect.arrayContaining([
        expect.objectContaining({ ruleName: 'Großer Eingang' }),
      ]),
    );
    expect(queue.deleteIds).toHaveBeenCalledWith(['d1', 'd2']);
  });

  it('skips the current bucket so in-flight enqueues are not flushed prematurely', async () => {
    const { scheduler, queue, email } = buildScheduler();
    const currentBucket = digestBucketKey('HOURLY');
    vi.mocked(queue.findReady).mockResolvedValue([
      makeQueued({ id: 'd1', bucketKey: currentBucket }),
    ]);
    await scheduler.flushHourly();
    expect(email.sendDigest).not.toHaveBeenCalled();
    expect(queue.deleteIds).not.toHaveBeenCalled();
  });

  it('does nothing when the queue is empty', async () => {
    const { scheduler, queue, email } = buildScheduler();
    vi.mocked(queue.findReady).mockResolvedValue([]);
    await scheduler.flushHourly();
    expect(email.sendDigest).not.toHaveBeenCalled();
    expect(queue.deleteIds).not.toHaveBeenCalled();
  });

  it('WEB_PUSH digests become a single summary push per user, not one per match', async () => {
    const { scheduler, queue, webPush } = buildScheduler();
    vi.mocked(webPush.isConfigured).mockReturnValue(true);
    vi.mocked(queue.findReady).mockResolvedValue([
      makeQueued({ id: 'p1', channel: 'WEB_PUSH', bucketKey: 'hour:2026-05-08T09' }),
      makeQueued({ id: 'p2', channel: 'WEB_PUSH', bucketKey: 'hour:2026-05-08T09' }),
    ]);
    await scheduler.flushHourly();
    expect(webPush.send).toHaveBeenCalledTimes(1);
  });
});
