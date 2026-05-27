import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AggregationsService } from './aggregations.service';
import type { PrismaService } from '../../prisma/prisma.service';

function build() {
  const prisma = {
    transaction: { aggregate: vi.fn(), count: vi.fn() },
    standingOrder: { findMany: vi.fn() },
    budget: { findFirst: vi.fn() },
  } as unknown as PrismaService;
  return { svc: new AggregationsService(prisma), prisma };
}

const ctx = { householdId: 'hh_1', userId: 'usr_1' };

beforeEach(() => vi.clearAllMocks());

describe('AggregationsService.resolveOne', () => {
  it('accountBalance sums transactions for the account', async () => {
    const { svc, prisma } = build();
    vi.mocked(prisma.transaction.aggregate).mockResolvedValue({
      _sum: { amountCents: 12345 },
    } as never);
    const v = await svc.resolveOne(ctx, { type: 'accountBalance', accountId: 'acc_1' });
    expect(v).toBe(12345);
  });

  it('sumAmount(expense) filters amount < 0', async () => {
    const { svc, prisma } = build();
    vi.mocked(prisma.transaction.aggregate).mockResolvedValue({
      _sum: { amountCents: -5000 },
    } as never);
    const v = await svc.resolveOne(ctx, {
      type: 'sumAmount',
      window: 'last30d',
      kind: 'expense',
    });
    expect(v).toBe(-5000);
    const call = vi.mocked(prisma.transaction.aggregate).mock.calls[0][0] as { where: { amountCents?: unknown } };
    expect(call.where.amountCents).toEqual({ lt: 0 });
  });

  it('countTransactions returns the count', async () => {
    const { svc, prisma } = build();
    vi.mocked(prisma.transaction.count).mockResolvedValue(7 as never);
    const v = await svc.resolveOne(ctx, {
      type: 'countTransactions',
      window: 'thisMonth',
    });
    expect(v).toBe(7);
  });

  it('budgetUsedPct returns null when no budget exists', async () => {
    const { svc, prisma } = build();
    vi.mocked(prisma.budget.findFirst).mockResolvedValue(null);
    const v = await svc.resolveOne(ctx, {
      type: 'budgetUsedPct',
      categoryId: 'cat_1',
    });
    expect(v).toBeNull();
  });

  it('budgetUsedPct computes |spent| / limit * 100', async () => {
    const { svc, prisma } = build();
    vi.mocked(prisma.budget.findFirst).mockResolvedValue({
      id: 'bdg_1',
      amountCents: 10000,
    } as never);
    vi.mocked(prisma.transaction.aggregate).mockResolvedValue({
      _sum: { amountCents: -7500 },
    } as never);
    const v = await svc.resolveOne(ctx, {
      type: 'budgetUsedPct',
      categoryId: 'cat_1',
    });
    expect(v).toBe(75);
  });

  it('upcomingStandingOrdersSum sums amounts of upcoming standing orders', async () => {
    const { svc, prisma } = build();
    vi.mocked(prisma.standingOrder.findMany).mockResolvedValue([
      { amountCents: -1500 },
      { amountCents: -3000 },
    ] as never);
    const v = await svc.resolveOne(ctx, {
      type: 'upcomingStandingOrdersSum',
      days: 7,
    });
    expect(v).toBe(-4500);
  });
});

describe('AggregationsService.makeResolver', () => {
  it('memoises identical aggregation lookups within one evaluation', async () => {
    const { svc, prisma } = build();
    vi.mocked(prisma.transaction.aggregate).mockResolvedValue({
      _sum: { amountCents: 100 },
    } as never);
    const resolve = svc.makeResolver(ctx);
    const spec = { type: 'accountBalance', accountId: 'acc_1' } as const;
    await resolve(spec);
    await resolve(spec);
    expect(prisma.transaction.aggregate).toHaveBeenCalledTimes(1);
  });

  it('returns null on resolver errors instead of throwing', async () => {
    const { svc, prisma } = build();
    vi.mocked(prisma.transaction.aggregate).mockRejectedValue(new Error('db down'));
    const resolve = svc.makeResolver(ctx);
    const v = await resolve({ type: 'accountBalance', accountId: 'acc_1' });
    expect(v).toBeNull();
  });
});
