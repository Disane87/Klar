import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { RecurringFrequency } from '@klar/shared';
import { Visibility, ProjectStatus } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import type { RequestContext } from '../common/types/request-context.type';
import { OverviewService } from './overview.service';

// ─── Factories ────────────────────────────────────────────────────────────────

const makeRt = (overrides: Record<string, unknown> = {}) => ({
  id: 'rt-1',
  householdId: 'hh1',
  createdByUserId: 'u1',
  name: 'Miete',
  amountCents: -80000,
  categoryId: 'cat-1',
  projectId: null,
  frequency: 'MONTHLY' as RecurringFrequency,
  customDays: null,
  dayOfMonth: 1,
  startDate: new Date('2026-01-01'),
  endDate: null,
  visibility: 'SHARED' as Visibility,
  isVariable: false,
  note: null,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const makeCat = (overrides: Record<string, unknown> = {}) => ({
  id: 'cat-1',
  householdId: 'hh1',
  name: 'Wohnen',
  color: '#60a5fa',
  type: 'EXPENSE',
  icon: null,
  isArchived: false,
  sortOrder: 0,
  isDefault: false,
  createdAt: new Date(),
  ...overrides,
});

const makeProject = (overrides: Record<string, unknown> = {}) => ({
  id: 'proj-1',
  householdId: 'hh1',
  createdByUserId: 'u1',
  name: 'Urlaub',
  description: null,
  status: ProjectStatus.ACTIVE,
  totalBudgetCents: 200000,
  startDate: null,
  endDate: null,
  color: '#34d399',
  visibility: Visibility.SHARED,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const makeTx = (overrides: Record<string, unknown> = {}) => ({
  id: 'tx-1',
  householdId: 'hh1',
  createdByUserId: 'u1',
  amountCents: -5000,
  categoryId: 'cat-1',
  projectId: null,
  date: new Date('2026-05-10'),
  description: 'Test',
  visibility: Visibility.SHARED,
  recurringTransactionId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

// ─── Context ──────────────────────────────────────────────────────────────────

const ctx: RequestContext = { userId: 'u1', householdId: 'hh1', source: 'web' };

// ─── Builder ──────────────────────────────────────────────────────────────────

function buildService(): { service: OverviewService; prisma: PrismaService } {
  const prisma = {
    recurringTransaction: { findMany: vi.fn().mockResolvedValue([]) },
    transaction: {
      findMany: vi.fn().mockResolvedValue([]),
      groupBy: vi.fn().mockResolvedValue([]),
    },
    category: { findMany: vi.fn().mockResolvedValue([]) },
    project: { findMany: vi.fn().mockResolvedValue([]) },
    budget: { findMany: vi.fn().mockResolvedValue([]) },
    account: { findMany: vi.fn().mockResolvedValue([]) },
    fixedCost: { findMany: vi.fn().mockResolvedValue([]) },
  } as unknown as PrismaService;

  const service = new OverviewService(prisma);
  return { service, prisma };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('OverviewService', () => {
  describe('getFixedCosts', () => {
    it('returns empty groups and totalCents=0 when no recurring transactions', async () => {
      const { service } = buildService();

      const result = await service.getFixedCosts(ctx, '2026-05');

      expect(result.month).toBe('2026-05');
      expect(result.totalCents).toBe(0);
      expect(result.groups).toEqual([]);
    });

    it('groups recurring transactions by category when data exists', async () => {
      const { service, prisma } = buildService();

      const cat = makeCat();
      const rt = { ...makeRt(), category: cat };

      vi.mocked(prisma.recurringTransaction.findMany).mockResolvedValue([rt] as never);

      const result = await service.getFixedCosts(ctx, '2026-05');

      expect(result.groups).toHaveLength(1);
      const group = result.groups[0];
      expect(group.categoryId).toBe('cat-1');
      expect(group.categoryName).toBe('Wohnen');
      expect(group.categoryColor).toBe('#60a5fa');
      expect(group.items).toHaveLength(1);
      expect(group.items[0].id).toBe('rt-1');
      expect(group.items[0].amountCents).toBe(-80000);
      expect(group.items[0].monthlyEquivalentCents).toBe(-80000);
      expect(group.totalCents).toBe(-80000);
      expect(result.totalCents).toBe(-80000);
    });

    it('excludes PRIVATE entries of other users (createdByUserId !== ctx.userId)', async () => {
      const { service, prisma } = buildService();

      const cat = makeCat();
      // This RT belongs to a different user and is private — must be excluded
      const otherUserRt = {
        ...makeRt({ createdByUserId: 'other-user', visibility: Visibility.PRIVATE }),
        category: cat,
      };
      // This RT is shared so it should always be visible
      const sharedRt = {
        ...makeRt({ id: 'rt-2', visibility: Visibility.SHARED }),
        category: cat,
      };

      vi.mocked(prisma.recurringTransaction.findMany).mockResolvedValue([
        otherUserRt,
        sharedRt,
      ] as never);

      const result = await service.getFixedCosts(ctx, '2026-05');

      expect(result.groups).toHaveLength(1);
      expect(result.groups[0].items).toHaveLength(1);
      expect(result.groups[0].items[0].id).toBe('rt-2');
    });

    it('excludes inactive recurring transactions (isActive: false)', async () => {
      const { service, prisma } = buildService();

      // isActive: false — the query already filters this out via the where clause,
      // but the service also checks isActiveInMonth via startDate/endDate.
      // We verify by returning nothing from the mock (as the DB would).
      vi.mocked(prisma.recurringTransaction.findMany).mockResolvedValue([] as never);

      const result = await service.getFixedCosts(ctx, '2026-05');

      expect(result.groups).toEqual([]);
      expect(result.totalCents).toBe(0);
      // Confirm the query was called with isActive: true
      expect(prisma.recurringTransaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isActive: true }),
        }),
      );
    });
  });

  describe('getCashflow', () => {
    it('returns all-zero result when no data', async () => {
      const { service } = buildService();

      const result = await service.getCashflow(ctx, '2026-05');

      expect(result.month).toBe('2026-05');
      expect(result.recurringIncomeCents).toBe(0);
      expect(result.recurringExpensesCents).toBe(0);
      expect(result.transactionIncomeCents).toBe(0);
      expect(result.transactionExpensesCents).toBe(0);
      expect(result.totalIncomeCents).toBe(0);
      expect(result.totalExpensesCents).toBe(0);
      expect(result.surplusCents).toBe(0);
    });

    it('separates income (positive amountCents) from expenses (negative amountCents)', async () => {
      const { service, prisma } = buildService();

      // Recurring income: +300000 (monthly)
      const incomeRt = makeRt({
        id: 'rt-income',
        amountCents: 300000,
        frequency: 'MONTHLY' as RecurringFrequency,
        visibility: Visibility.SHARED,
      });
      // Recurring expense: -80000 (monthly)
      const expenseRt = makeRt({
        id: 'rt-expense',
        amountCents: -80000,
        frequency: 'MONTHLY' as RecurringFrequency,
        visibility: Visibility.SHARED,
      });

      vi.mocked(prisma.recurringTransaction.findMany).mockResolvedValue([
        incomeRt,
        expenseRt,
      ] as never);

      // Ad-hoc transaction income
      const txIncome = makeTx({ id: 'tx-income', amountCents: 5000 });
      // Ad-hoc transaction expense
      const txExpense = makeTx({ id: 'tx-expense', amountCents: -2000 });

      vi.mocked(prisma.transaction.findMany).mockResolvedValue([
        txIncome,
        txExpense,
      ] as never);

      const result = await service.getCashflow(ctx, '2026-05');

      expect(result.recurringIncomeCents).toBe(300000);
      expect(result.recurringExpensesCents).toBe(80000);
      expect(result.transactionIncomeCents).toBe(5000);
      expect(result.transactionExpensesCents).toBe(2000);
      expect(result.totalIncomeCents).toBe(305000);
      expect(result.totalExpensesCents).toBe(82000);
      expect(result.surplusCents).toBe(223000);
    });
  });

  describe('getProjects', () => {
    it('returns empty projects list when no active projects', async () => {
      const { service } = buildService();

      const result = await service.getProjects(ctx, ProjectStatus.ACTIVE);

      expect(result.projects).toEqual([]);
    });

    it('returns project overview items with aggregated transaction data', async () => {
      const { service, prisma } = buildService();

      const project = makeProject();
      vi.mocked(prisma.project.findMany).mockResolvedValue([project] as never);

      // Realized: 1× +10000 income, 1× -4000 expense (with archived plan -3000 → +1000 deviation)
      // Planned:  1× -2000 expense
      vi.mocked(prisma.transaction.findMany).mockResolvedValue([
        { projectId: 'proj-1', amountCents: 10000, plannedAmountCents: null,  isPlanned: false },
        { projectId: 'proj-1', amountCents: -4000, plannedAmountCents: -3000, isPlanned: false },
        { projectId: 'proj-1', amountCents: -2000, plannedAmountCents: null,  isPlanned: true  },
      ] as never);

      const result = await service.getProjects(ctx);

      expect(result.projects).toHaveLength(1);
      const item = result.projects[0];
      expect(item.id).toBe('proj-1');
      expect(item.name).toBe('Urlaub');
      expect(item.transactionCount).toBe(3);
      expect(item.incomeCents).toBe(10000);
      expect(item.spentCents).toBe(4000);
      expect(item.balanceCents).toBe(6000);
      expect(item.plannedSpentCents).toBe(2000);
      expect(item.plannedIncomeCents).toBe(0);
      expect(item.deviationCents).toBe(-1000);
      expect(item.totalBudgetCents).toBe(200000);
    });

    it('applies status filter when a valid status is provided', async () => {
      const { service, prisma } = buildService();

      vi.mocked(prisma.project.findMany).mockResolvedValue([] as never);

      await service.getProjects(ctx, ProjectStatus.COMPLETED);

      expect(prisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: ProjectStatus.COMPLETED,
          }),
        }),
      );
    });
  });

  describe('getBudgetsVsActuals', () => {
    it('returns empty rows when no budgets exist for the month', async () => {
      const { service } = buildService();

      const result = await service.getBudgetsVsActuals(ctx, '2026-05');

      expect(result.month).toBe('2026-05');
      expect(result.rows).toEqual([]);
    });

    it('signs Soll negative for expense categories and aggregates tx + recurring as Ist', async () => {
      const { service, prisma } = buildService();

      const cat = makeCat({ type: 'VARIABLE_EXPENSE' });
      vi.mocked(prisma.budget.findMany).mockResolvedValue([
        { categoryId: 'cat-1', amountCents: 50000, category: cat },
      ] as never);

      vi.mocked(prisma.transaction.findMany).mockResolvedValue([
        makeTx({ amountCents: -20000 }),
      ] as never);

      vi.mocked(prisma.recurringTransaction.findMany).mockResolvedValue([
        makeRt({ amountCents: -10000, frequency: 'MONTHLY' }),
      ] as never);

      const result = await service.getBudgetsVsActuals(ctx, '2026-05');

      expect(result.rows).toHaveLength(1);
      const row = result.rows[0];
      expect(row.categoryId).toBe('cat-1');
      expect(row.sollCents).toBe(-50000);
      // -20000 (tx) + -10000 (recurring monthly) = -30000
      expect(row.istCents).toBe(-30000);
      expect(row.deltaCents).toBe(-20000);
      expect(row.state).toBe('ok');
    });

    it('keeps Soll positive for income categories', async () => {
      const { service, prisma } = buildService();

      const cat = makeCat({ id: 'cat-inc', type: 'FIXED_INCOME' });
      vi.mocked(prisma.budget.findMany).mockResolvedValue([
        { categoryId: 'cat-inc', amountCents: 300000, category: cat },
      ] as never);

      const result = await service.getBudgetsVsActuals(ctx, '2026-05');

      expect(result.rows[0].sollCents).toBe(300000);
      expect(result.rows[0].istCents).toBe(0);
    });

    it('excludes PRIVATE transactions of other users from Ist', async () => {
      const { service, prisma } = buildService();

      const cat = makeCat({ type: 'VARIABLE_EXPENSE' });
      vi.mocked(prisma.budget.findMany).mockResolvedValue([
        { categoryId: 'cat-1', amountCents: 10000, category: cat },
      ] as never);

      vi.mocked(prisma.transaction.findMany).mockResolvedValue([
        makeTx({ amountCents: -5000, visibility: Visibility.PRIVATE, createdByUserId: 'other' }),
        makeTx({ id: 'tx-2', amountCents: -3000, visibility: Visibility.SHARED }),
      ] as never);

      const result = await service.getBudgetsVsActuals(ctx, '2026-05');

      // Only the shared one counts
      expect(result.rows[0].istCents).toBe(-3000);
    });
  });

  describe('getLiquidityForecast', () => {
    /**
     * Anchors the forecast clock so day-of-month-dependent branches are
     * stable. With today = 2026-05-15, daysRemaining = 18 (today + the
     * 16 remaining days + EOM, rounded inclusively).
     */
    const FIXED_NOW = new Date('2026-05-15T10:00:00.000Z');

    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(FIXED_NOW);
    });

    const makeAccount = (overrides: Record<string, unknown> = {}) => ({
      id: 'acc-1',
      lastKnownBalanceCents: 200_000,
      ...overrides,
    });

    const makeFixedCost = (overrides: Record<string, unknown> = {}) => ({
      id: 'fc-1',
      name: 'Miete',
      amountCents: -125_000,
      nextRenewalAt: new Date('2026-05-20T00:00:00.000Z'),
      ...overrides,
    });

    it('classifies the forecast as green when the buffer beats 500€', async () => {
      const { service, prisma } = buildService();
      vi.mocked(prisma.account.findMany).mockResolvedValue([
        makeAccount({ lastKnownBalanceCents: 300_000 }),
      ] as never);
      // No recurring income, no fixed costs, no variable spend → forecast = balance.
      const result = await service.getLiquidityForecast(ctx);
      expect(result.forecastEomCents).toBe(300_000);
      expect(result.comfortZone).toBe('green');
      expect(result.daysRemaining).toBe(18);
      expect(result.accountsTotal).toBe(1);
      expect(result.accountsWithBalance).toBe(1);
    });

    it('classifies the forecast as yellow between 0 and 50000 cents', async () => {
      const { service, prisma } = buildService();
      vi.mocked(prisma.account.findMany).mockResolvedValue([
        makeAccount({ lastKnownBalanceCents: 20_000 }),
      ] as never);
      const result = await service.getLiquidityForecast(ctx);
      expect(result.comfortZone).toBe('yellow');
    });

    it('classifies the forecast as red when the bottom line is negative', async () => {
      const { service, prisma } = buildService();
      vi.mocked(prisma.account.findMany).mockResolvedValue([
        makeAccount({ lastKnownBalanceCents: 50_000 }),
      ] as never);
      vi.mocked(prisma.fixedCost.findMany).mockResolvedValue([
        makeFixedCost({ amountCents: -200_000 }),
      ] as never);
      const result = await service.getLiquidityForecast(ctx);
      expect(result.pendingFixedCostsCents).toBe(200_000);
      expect(result.forecastEomCents).toBeLessThan(0);
      expect(result.comfortZone).toBe('red');
    });

    it('counts MONTHLY recurring income only if the due day has not passed yet', async () => {
      const { service, prisma } = buildService();
      vi.mocked(prisma.account.findMany).mockResolvedValue([
        makeAccount({ lastKnownBalanceCents: 100_000 }),
      ] as never);
      vi.mocked(prisma.recurringTransaction.findMany).mockResolvedValue([
        // Salary: dayOfMonth 25 → still upcoming on the 15th, counts.
        makeRt({ id: 'rt-salary', amountCents: 250_000, dayOfMonth: 25 }),
        // Already-paid salary on the 1st → must not count.
        makeRt({ id: 'rt-past', amountCents: 80_000, dayOfMonth: 1 }),
        // Expenses don't add income.
        makeRt({ id: 'rt-expense', amountCents: -30_000, dayOfMonth: 25 }),
        // Non-MONTHLY frequency is excluded from income in v1.
        makeRt({
          id: 'rt-quarterly',
          amountCents: 100_000,
          dayOfMonth: 25,
          frequency: 'QUARTERLY' as RecurringFrequency,
        }),
      ] as never);
      const result = await service.getLiquidityForecast(ctx);
      expect(result.expectedIncomeRemainingCents).toBe(250_000);
    });

    it('projects 30-day variable spend forward by daysRemaining', async () => {
      const { service, prisma } = buildService();
      vi.mocked(prisma.account.findMany).mockResolvedValue([
        makeAccount({ lastKnownBalanceCents: 500_000 }),
      ] as never);
      // 30 days × 100€ → 3000€ total → 100€/day average.
      const variableTxs = Array.from({ length: 30 }, (_, i) => ({
        amountCents: -10_000,
        _key: i, // unused but keeps the objects distinct for clarity
      }));
      vi.mocked(prisma.transaction.findMany).mockResolvedValue(variableTxs as never);

      const result = await service.getLiquidityForecast(ctx);

      expect(result.variableDailyAvgCents).toBe(10_000);
      expect(result.variableForecastCents).toBe(10_000 * result.daysRemaining);
    });

    it('returns upcoming fixed-cost and recurring items within the 7-day window, sorted by date', async () => {
      const { service, prisma } = buildService();
      vi.mocked(prisma.account.findMany).mockResolvedValue([
        makeAccount({ lastKnownBalanceCents: 500_000 }),
      ] as never);
      vi.mocked(prisma.fixedCost.findMany).mockResolvedValue([
        // In window (today + 5 days).
        makeFixedCost({ id: 'fc-in', name: 'Streaming', nextRenewalAt: new Date('2026-05-20T00:00:00.000Z') }),
        // Outside the 7-day window (today + 10 days) — still in the EOM
        // pendingFixedCosts total, but NOT in upcomingItems.
        makeFixedCost({ id: 'fc-out', name: 'Versicherung', nextRenewalAt: new Date('2026-05-25T00:00:00.000Z') }),
      ] as never);
      vi.mocked(prisma.recurringTransaction.findMany).mockResolvedValue([
        // Recurring income on the 18th (today + 3 days) → in window.
        makeRt({ id: 'rt-near', name: 'Gehalt', amountCents: 250_000, dayOfMonth: 18 }),
      ] as never);

      const result = await service.getLiquidityForecast(ctx);

      expect(result.upcomingItems).toHaveLength(2);
      // Sorted by ISO date string — 2026-05-18 (Gehalt) before 2026-05-20 (Streaming).
      expect(result.upcomingItems[0].label).toBe('Gehalt');
      expect(result.upcomingItems[0].kind).toBe('recurring');
      expect(result.upcomingItems[0].amountCents).toBe(250_000);
      expect(result.upcomingItems[1].label).toBe('Streaming');
      expect(result.upcomingItems[1].kind).toBe('fixed-cost');
      expect(result.upcomingItems[1].amountCents).toBe(-125_000);
    });

    it('scopes all queries to SHARED plus the requesting user’s PRIVATE entries', async () => {
      const { service, prisma } = buildService();
      vi.mocked(prisma.account.findMany).mockResolvedValue([] as never);

      await service.getLiquidityForecast(ctx);

      // Accounts query must include the PRIVATE+ownerId OR shape.
      expect(prisma.account.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            householdId: 'hh1',
            archivedAt: null,
            OR: expect.arrayContaining([
              { visibility: Visibility.SHARED },
              { visibility: Visibility.PRIVATE, ownerId: 'u1' },
            ]),
          }),
        }),
      );

      // Variable-spend transactions: TRANSFERs are excluded.
      expect(prisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            householdId: 'hh1',
            isPlanned: false,
            recurringTransactionId: null,
            NOT: { transactionKind: 'TRANSFER' },
          }),
        }),
      );
    });

    it('handles accounts without a last-known balance without falling over', async () => {
      const { service, prisma } = buildService();
      vi.mocked(prisma.account.findMany).mockResolvedValue([
        makeAccount({ id: 'acc-known', lastKnownBalanceCents: 150_000 }),
        makeAccount({ id: 'acc-unknown', lastKnownBalanceCents: null }),
      ] as never);

      const result = await service.getLiquidityForecast(ctx);

      expect(result.currentLiquidityCents).toBe(150_000);
      expect(result.accountsTotal).toBe(2);
      expect(result.accountsWithBalance).toBe(1);
    });
  });
});
