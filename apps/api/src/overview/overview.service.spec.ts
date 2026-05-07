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
});
