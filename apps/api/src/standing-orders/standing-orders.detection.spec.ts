import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StandingOrdersDetection } from './standing-orders.detection';
import type { StandingOrdersRepository } from './standing-orders.repository';

function makeRepo(): StandingOrdersRepository {
  return {
    listStandingOrderTransactions: vi.fn(),
    upsertByGroupKey: vi.fn(),
  } as unknown as StandingOrdersRepository;
}

const STANDING_ORDER = 'STANDING_ORDER' as const;
const DIRECT_DEBIT = 'DIRECT_DEBIT' as const;

describe('StandingOrdersDetection', () => {
  let repo: StandingOrdersRepository;
  let svc: StandingOrdersDetection;

  beforeEach(() => {
    repo = makeRepo();
    svc = new StandingOrdersDetection(repo);
  });

  it('groups STANDING_ORDER tx by (kind, counterparty, amount) and upserts MONTHLY for 3 monthly bookings', async () => {
    (repo.listStandingOrderTransactions as any).mockResolvedValue([
      { date: '2026-03-01', amountCents: -12550, counterpartyName: 'Vermieter GmbH', counterpartyIban: 'DE1', transactionKind: STANDING_ORDER },
      { date: '2026-04-01', amountCents: -12550, counterpartyName: 'Vermieter GmbH', counterpartyIban: 'DE1', transactionKind: STANDING_ORDER },
      { date: '2026-05-01', amountCents: -12550, counterpartyName: 'VERMIETER  GMBH', counterpartyIban: 'DE1', transactionKind: STANDING_ORDER },
    ]);

    await svc.runForAccount({ householdId: 'h1', accountId: 'a1' });

    expect(repo.upsertByGroupKey).toHaveBeenCalledTimes(1);
    expect(repo.upsertByGroupKey).toHaveBeenCalledWith(
      expect.objectContaining({
        householdId: 'h1',
        accountId: 'a1',
        groupKey: 'standing_order|vermieter gmbh|-12550',
        transactionKind: STANDING_ORDER,
        counterpartyName: 'Vermieter GmbH',
        amountCents: -12550,
        frequency: 'MONTHLY',
        lastSeenAt: '2026-05-01',
        nextExpectedAt: '2026-05-31',
        source: 'FINTS_DERIVED',
      }),
    );
  });

  it('skips STANDING_ORDER groups with only 1 booking', async () => {
    (repo.listStandingOrderTransactions as any).mockResolvedValue([
      { date: '2026-05-01', amountCents: -100, counterpartyName: 'Solo', counterpartyIban: null, transactionKind: STANDING_ORDER },
    ]);

    await svc.runForAccount({ householdId: 'h1', accountId: 'a1' });

    expect(repo.upsertByGroupKey).not.toHaveBeenCalled();
  });

  it('skips DIRECT_DEBIT groups with only 2 bookings (threshold = 3)', async () => {
    (repo.listStandingOrderTransactions as any).mockResolvedValue([
      { date: '2026-04-01', amountCents: -2999, counterpartyName: 'Some Insurance', counterpartyIban: null, transactionKind: DIRECT_DEBIT },
      { date: '2026-05-01', amountCents: -2999, counterpartyName: 'Some Insurance', counterpartyIban: null, transactionKind: DIRECT_DEBIT },
    ]);

    await svc.runForAccount({ householdId: 'h1', accountId: 'a1' });

    expect(repo.upsertByGroupKey).not.toHaveBeenCalled();
  });

  it('upserts DIRECT_DEBIT groups with 3+ bookings as DIRECT_DEBIT records', async () => {
    (repo.listStandingOrderTransactions as any).mockResolvedValue([
      { date: '2026-03-01', amountCents: -3780, counterpartyName: 'ERGO', counterpartyIban: null, transactionKind: DIRECT_DEBIT },
      { date: '2026-04-01', amountCents: -3780, counterpartyName: 'ERGO', counterpartyIban: null, transactionKind: DIRECT_DEBIT },
      { date: '2026-05-01', amountCents: -3780, counterpartyName: 'ERGO', counterpartyIban: null, transactionKind: DIRECT_DEBIT },
    ]);

    await svc.runForAccount({ householdId: 'h1', accountId: 'a1' });

    expect(repo.upsertByGroupKey).toHaveBeenCalledTimes(1);
    expect(repo.upsertByGroupKey).toHaveBeenCalledWith(
      expect.objectContaining({
        groupKey: 'direct_debit|ergo|-3780',
        transactionKind: DIRECT_DEBIT,
        frequency: 'MONTHLY',
      }),
    );
  });

  it('separates a Bank-Dauerauftrag and a SEPA-Lastschrift to the same recipient + amount', async () => {
    (repo.listStandingOrderTransactions as any).mockResolvedValue([
      // Three Lastschriften
      { date: '2026-03-01', amountCents: -5000, counterpartyName: 'Acme', counterpartyIban: null, transactionKind: DIRECT_DEBIT },
      { date: '2026-04-01', amountCents: -5000, counterpartyName: 'Acme', counterpartyIban: null, transactionKind: DIRECT_DEBIT },
      { date: '2026-05-01', amountCents: -5000, counterpartyName: 'Acme', counterpartyIban: null, transactionKind: DIRECT_DEBIT },
      // Two Daueraufträge to the same recipient + amount
      { date: '2026-04-15', amountCents: -5000, counterpartyName: 'Acme', counterpartyIban: null, transactionKind: STANDING_ORDER },
      { date: '2026-05-15', amountCents: -5000, counterpartyName: 'Acme', counterpartyIban: null, transactionKind: STANDING_ORDER },
    ]);

    await svc.runForAccount({ householdId: 'h1', accountId: 'a1' });

    expect(repo.upsertByGroupKey).toHaveBeenCalledTimes(2);
    const calls = (repo.upsertByGroupKey as any).mock.calls.map((c: any) => c[0].transactionKind);
    expect(calls).toEqual(expect.arrayContaining([STANDING_ORDER, DIRECT_DEBIT]));
  });

  it('uses CUSTOM frequency when gaps mix incompatibly', async () => {
    (repo.listStandingOrderTransactions as any).mockResolvedValue([
      { date: '2026-01-01', amountCents: -50, counterpartyName: 'X', counterpartyIban: null, transactionKind: STANDING_ORDER },
      { date: '2026-01-15', amountCents: -50, counterpartyName: 'X', counterpartyIban: null, transactionKind: STANDING_ORDER },
      { date: '2026-03-01', amountCents: -50, counterpartyName: 'X', counterpartyIban: null, transactionKind: STANDING_ORDER },
    ]);

    await svc.runForAccount({ householdId: 'h1', accountId: 'a1' });

    expect(repo.upsertByGroupKey).toHaveBeenCalledWith(
      expect.objectContaining({ frequency: 'CUSTOM', nextExpectedAt: null }),
    );
  });

  it('forwards bookingText from the most-recent transaction in the group', async () => {
    (repo.listStandingOrderTransactions as any).mockResolvedValue([
      { date: '2026-03-01', amountCents: -1000, counterpartyName: 'Netflix', counterpartyIban: null, transactionKind: DIRECT_DEBIT, bookingText: 'LASTSCHRIFT' },
      { date: '2026-04-01', amountCents: -1000, counterpartyName: 'Netflix', counterpartyIban: null, transactionKind: DIRECT_DEBIT, bookingText: 'LASTSCHRIFT' },
      { date: '2026-05-01', amountCents: -1000, counterpartyName: 'Netflix', counterpartyIban: null, transactionKind: DIRECT_DEBIT, bookingText: 'FOLGELASTSCHRIFT' },
    ]);

    await svc.runForAccount({ householdId: 'h1', accountId: 'a1' });

    expect(repo.upsertByGroupKey).toHaveBeenCalledWith(
      expect.objectContaining({
        groupKey: 'direct_debit|netflix|-1000',
        bookingText: 'FOLGELASTSCHRIFT',
      }),
    );
  });

  it('falls back to an earlier non-null bookingText when the latest tx has none', async () => {
    (repo.listStandingOrderTransactions as any).mockResolvedValue([
      { date: '2026-03-01', amountCents: -500, counterpartyName: 'Stadtwerke', counterpartyIban: null, transactionKind: STANDING_ORDER, bookingText: 'DAUERAUFTRAG' },
      { date: '2026-04-01', amountCents: -500, counterpartyName: 'Stadtwerke', counterpartyIban: null, transactionKind: STANDING_ORDER, bookingText: null },
    ]);

    await svc.runForAccount({ householdId: 'h1', accountId: 'a1' });

    expect(repo.upsertByGroupKey).toHaveBeenCalledWith(
      expect.objectContaining({ bookingText: 'DAUERAUFTRAG' }),
    );
  });

  it('passes bookingText: null when no tx has a label', async () => {
    (repo.listStandingOrderTransactions as any).mockResolvedValue([
      { date: '2026-03-01', amountCents: -100, counterpartyName: 'X', counterpartyIban: null, transactionKind: STANDING_ORDER, bookingText: null },
      { date: '2026-04-01', amountCents: -100, counterpartyName: 'X', counterpartyIban: null, transactionKind: STANDING_ORDER, bookingText: null },
    ]);

    await svc.runForAccount({ householdId: 'h1', accountId: 'a1' });

    expect(repo.upsertByGroupKey).toHaveBeenCalledWith(
      expect.objectContaining({ bookingText: null }),
    );
  });

  it('groups separately when amountCents differs', async () => {
    (repo.listStandingOrderTransactions as any).mockResolvedValue([
      { date: '2026-03-01', amountCents: -100, counterpartyName: 'A', counterpartyIban: null, transactionKind: STANDING_ORDER },
      { date: '2026-04-01', amountCents: -100, counterpartyName: 'A', counterpartyIban: null, transactionKind: STANDING_ORDER },
      { date: '2026-03-01', amountCents: -200, counterpartyName: 'A', counterpartyIban: null, transactionKind: STANDING_ORDER },
      { date: '2026-04-01', amountCents: -200, counterpartyName: 'A', counterpartyIban: null, transactionKind: STANDING_ORDER },
    ]);

    await svc.runForAccount({ householdId: 'h1', accountId: 'a1' });

    expect(repo.upsertByGroupKey).toHaveBeenCalledTimes(2);
  });
});
