import { describe, it, expect, vi } from 'vitest';
import { Visibility, type NotificationRule } from '@prisma/client';
import { RulesEngineService } from './rules-engine.service';
import type { NotificationRulesRepository } from './notification-rules.repository';
import type { InAppDispatcher } from './dispatchers/in-app.dispatcher';
import type { WebPushDispatcher } from './dispatchers/web-push.dispatcher';
import type { EmailDispatcher } from './dispatchers/email.dispatcher';
import type { DigestQueueRepository } from './digest/digest-queue.repository';
import type { TransactionCreatedEvent } from './events/rule-events';

function makeRule(over: Partial<NotificationRule> = {}): NotificationRule {
  return {
    id: 'nrl_1',
    householdId: 'hh_1',
    userId: 'usr_1',
    name: 'Großer Eingang',
    enabled: true,
    trigger: 'TRANSACTION_CREATED',
    predicateJson: { op: 'cmp', field: 'amountCents', operator: '>', value: 100000 },
    scheduleJson: null,
    leadTimeDays: null,
    channels: ['IN_APP'],
    digestMode: 'IMMEDIATE',
    cooldownMinutes: null,
    maxPerHour: null,
    maxPerDay: null,
    lastFiredAt: null,
    firedCountToday: 0,
    firedBucketDate: null,
    createdAt: new Date('2026-05-01T00:00:00Z'),
    updatedAt: new Date('2026-05-01T00:00:00Z'),
    ...over,
  } as NotificationRule;
}

function makeEvent(over: Partial<TransactionCreatedEvent> = {}): TransactionCreatedEvent {
  return {
    transactionId: 'tx_1',
    householdId: 'hh_1',
    ownerUserId: 'usr_1',
    visibility: Visibility.SHARED,
    fields: {
      amountCents: 250000,
      isIncome: true,
      kind: null,
      categoryId: 'cat_salary',
      projectId: null,
      accountId: 'acc_1',
      counterparty: 'Arbeitgeber GmbH',
      description: null,
      bookingText: null,
      date: '2026-05-01',
    },
    ...over,
  };
}

function buildEngine() {
  const repo = {
    findAll: vi.fn(),
    hasFired: vi.fn().mockResolvedValue(false),
    recordFire: vi.fn().mockResolvedValue({}),
    updateThrottleCounters: vi.fn().mockResolvedValue(undefined),
  } as unknown as NotificationRulesRepository;
  const inApp = { dispatch: vi.fn().mockResolvedValue('ntf_new') } as unknown as InAppDispatcher;
  const webPush = {
    isConfigured: vi.fn().mockReturnValue(false),
    send: vi.fn().mockResolvedValue(0),
  } as unknown as WebPushDispatcher;
  const email = {
    sendImmediate: vi.fn().mockResolvedValue(true),
    sendDigest: vi.fn().mockResolvedValue(true),
  } as unknown as EmailDispatcher;
  const digestQueue = {
    enqueue: vi.fn().mockResolvedValue({}),
  } as unknown as DigestQueueRepository;
  return {
    engine: new RulesEngineService(repo, inApp, webPush, email, digestQueue),
    repo,
    inApp,
    webPush,
    email,
    digestQueue,
  };
}

describe('RulesEngineService.onTransactionCreated', () => {
  it('dispatches when the predicate matches', async () => {
    const { engine, repo, inApp } = buildEngine();
    vi.mocked(repo.findAll).mockResolvedValue([makeRule()]);
    await engine.onTransactionCreated(makeEvent());
    expect(inApp.dispatch).toHaveBeenCalledTimes(1);
    expect(repo.recordFire).toHaveBeenCalledWith(
      expect.objectContaining({
        ruleId: 'nrl_1',
        sourceKind: 'transaction',
        sourceId: 'tx_1',
        channelsSent: ['IN_APP'],
      }),
    );
  });

  it('does not dispatch when the predicate does not match', async () => {
    const { engine, repo, inApp } = buildEngine();
    vi.mocked(repo.findAll).mockResolvedValue([makeRule()]);
    await engine.onTransactionCreated(makeEvent({ fields: { ...makeEvent().fields, amountCents: 100 } }));
    expect(inApp.dispatch).not.toHaveBeenCalled();
    expect(repo.recordFire).not.toHaveBeenCalled();
  });

  it('idempotency: skips when the rule already fired for this transaction', async () => {
    const { engine, repo, inApp } = buildEngine();
    vi.mocked(repo.findAll).mockResolvedValue([makeRule()]);
    vi.mocked(repo.hasFired).mockResolvedValue(true);
    await engine.onTransactionCreated(makeEvent());
    expect(inApp.dispatch).not.toHaveBeenCalled();
  });

  it('throttles when within the cooldown window', async () => {
    const { engine, repo, inApp } = buildEngine();
    const recent = new Date(Date.now() - 60_000); // 1 minute ago
    vi.mocked(repo.findAll).mockResolvedValue([
      makeRule({ cooldownMinutes: 10, lastFiredAt: recent }),
    ]);
    await engine.onTransactionCreated(makeEvent());
    expect(inApp.dispatch).not.toHaveBeenCalled();
  });

  it('PRIVATE-skip: rule owned by user B does not see user A PRIVATE transaction', async () => {
    const { engine, repo, inApp } = buildEngine();
    vi.mocked(repo.findAll).mockResolvedValue([makeRule({ userId: 'usr_b' })]);
    await engine.onTransactionCreated(
      makeEvent({ visibility: Visibility.PRIVATE, ownerUserId: 'usr_a' }),
    );
    expect(inApp.dispatch).not.toHaveBeenCalled();
  });

  it('PRIVATE allows owner: same-user PRIVATE tx still triggers their own rule', async () => {
    const { engine, repo, inApp } = buildEngine();
    vi.mocked(repo.findAll).mockResolvedValue([makeRule({ userId: 'usr_a' })]);
    await engine.onTransactionCreated(
      makeEvent({ visibility: Visibility.PRIVATE, ownerUserId: 'usr_a' }),
    );
    expect(inApp.dispatch).toHaveBeenCalled();
  });

  it('batch: pre-fetches rules once and reuses across events', async () => {
    const { engine, repo, inApp } = buildEngine();
    vi.mocked(repo.findAll).mockResolvedValue([makeRule()]);
    await engine.onTransactionCreatedBatch({
      householdId: 'hh_1',
      source: 'csv-import',
      events: [makeEvent(), makeEvent({ transactionId: 'tx_2' })],
    });
    expect(repo.findAll).toHaveBeenCalledTimes(1);
    expect(inApp.dispatch).toHaveBeenCalledTimes(2);
  });
});

describe('RulesEngineService.dispatchTest', () => {
  it('only fires channels configured on the rule', async () => {
    const { engine, inApp } = buildEngine();
    const sent = await engine.dispatchTest(makeRule({ channels: ['IN_APP'] }));
    expect(sent).toEqual(['IN_APP']);
    expect(inApp.dispatch).toHaveBeenCalled();
  });

  it('returns empty when no channels enabled', async () => {
    const { engine, inApp } = buildEngine();
    const sent = await engine.dispatchTest(makeRule({ channels: [] }));
    expect(sent).toEqual([]);
    expect(inApp.dispatch).not.toHaveBeenCalled();
  });

  it('digestMode HOURLY enqueues EMAIL instead of sending immediately', async () => {
    const { engine, repo, email, digestQueue } = buildEngine();
    vi.mocked(repo.findAll).mockResolvedValue([
      makeRule({ channels: ['IN_APP', 'EMAIL'], digestMode: 'HOURLY' }),
    ]);
    await engine.onTransactionCreated(makeEvent());
    expect(email.sendImmediate).not.toHaveBeenCalled();
    expect(digestQueue.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'EMAIL', ruleId: 'nrl_1' }),
    );
  });

  it('also fans out via WEB_PUSH when channel + dispatcher configured', async () => {
    const { engine, webPush, inApp } = buildEngine();
    vi.mocked(webPush.isConfigured).mockReturnValue(true);
    vi.mocked(webPush.send).mockResolvedValue(1);
    const sent = await engine.dispatchTest(
      makeRule({ channels: ['IN_APP', 'WEB_PUSH'] }),
    );
    expect(sent).toEqual(['IN_APP', 'WEB_PUSH']);
    expect(inApp.dispatch).toHaveBeenCalled();
    expect(webPush.send).toHaveBeenCalled();
  });

  it('skips WEB_PUSH silently when VAPID is not configured', async () => {
    const { engine, webPush } = buildEngine();
    vi.mocked(webPush.isConfigured).mockReturnValue(false);
    const sent = await engine.dispatchTest(
      makeRule({ channels: ['IN_APP', 'WEB_PUSH'] }),
    );
    expect(sent).toEqual(['IN_APP']);
    expect(webPush.send).not.toHaveBeenCalled();
  });
});
