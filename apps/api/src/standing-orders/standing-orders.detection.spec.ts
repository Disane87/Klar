import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StandingOrdersDetection } from './standing-orders.detection';
import type { StandingOrdersRepository } from './standing-orders.repository';

function makeRepo(): StandingOrdersRepository {
  return {
    listStandingOrderTransactions: vi.fn(),
    upsertByGroupKey: vi.fn(),
  } as unknown as StandingOrdersRepository;
}

describe('StandingOrdersDetection', () => {
  let repo: StandingOrdersRepository;
  let svc: StandingOrdersDetection;

  beforeEach(() => {
    repo = makeRepo();
    svc = new StandingOrdersDetection(repo);
  });

  it('groups by (counterpartyKey, amountCents) and upserts MONTHLY for 3 monthly bookings', async () => {
    (repo.listStandingOrderTransactions as any).mockResolvedValue([
      { date: '2026-03-01', amountCents: -12550, counterpartyName: 'Vermieter GmbH', counterpartyIban: 'DE1' },
      { date: '2026-04-01', amountCents: -12550, counterpartyName: 'Vermieter GmbH', counterpartyIban: 'DE1' },
      { date: '2026-05-01', amountCents: -12550, counterpartyName: 'VERMIETER  GMBH', counterpartyIban: 'DE1' },
    ]);

    await svc.runForAccount({ householdId: 'h1', accountId: 'a1' });

    expect(repo.upsertByGroupKey).toHaveBeenCalledTimes(1);
    expect(repo.upsertByGroupKey).toHaveBeenCalledWith(
      expect.objectContaining({
        householdId: 'h1',
        accountId: 'a1',
        groupKey: 'vermieter gmbh|-12550',
        counterpartyName: 'Vermieter GmbH',
        amountCents: -12550,
        frequency: 'MONTHLY',
        lastSeenAt: '2026-05-01',
        nextExpectedAt: '2026-05-31',
        source: 'FINTS_DERIVED',
      }),
    );
  });

  it('skips groups with fewer than 2 bookings', async () => {
    (repo.listStandingOrderTransactions as any).mockResolvedValue([
      { date: '2026-05-01', amountCents: -100, counterpartyName: 'Solo', counterpartyIban: null },
    ]);

    await svc.runForAccount({ householdId: 'h1', accountId: 'a1' });

    expect(repo.upsertByGroupKey).not.toHaveBeenCalled();
  });

  it('uses CUSTOM frequency when gaps mix incompatibly', async () => {
    (repo.listStandingOrderTransactions as any).mockResolvedValue([
      { date: '2026-01-01', amountCents: -50, counterpartyName: 'X', counterpartyIban: null },
      { date: '2026-01-15', amountCents: -50, counterpartyName: 'X', counterpartyIban: null },
      { date: '2026-03-01', amountCents: -50, counterpartyName: 'X', counterpartyIban: null },
    ]);

    await svc.runForAccount({ householdId: 'h1', accountId: 'a1' });

    expect(repo.upsertByGroupKey).toHaveBeenCalledWith(
      expect.objectContaining({ frequency: 'CUSTOM', nextExpectedAt: null }),
    );
  });

  it('groups separately when amountCents differs', async () => {
    (repo.listStandingOrderTransactions as any).mockResolvedValue([
      { date: '2026-03-01', amountCents: -100, counterpartyName: 'A', counterpartyIban: null },
      { date: '2026-04-01', amountCents: -100, counterpartyName: 'A', counterpartyIban: null },
      { date: '2026-03-01', amountCents: -200, counterpartyName: 'A', counterpartyIban: null },
      { date: '2026-04-01', amountCents: -200, counterpartyName: 'A', counterpartyIban: null },
    ]);

    await svc.runForAccount({ householdId: 'h1', accountId: 'a1' });

    expect(repo.upsertByGroupKey).toHaveBeenCalledTimes(2);
  });
});
