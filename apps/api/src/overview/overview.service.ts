import { Injectable } from '@nestjs/common';
import type { Category, Project, RecurringTransaction, Transaction } from '@prisma/client';
import { ProjectStatus, Visibility } from '@prisma/client';
import type { RecurringFrequency } from '@klar/shared';
import {
  calculateMonthlyOverview,
  currentYearMonth,
  toMonthlyEquivalent,
} from '@klar/shared';
import { PrismaService } from '../prisma/prisma.service';
import type { RequestContext } from '../common/types/request-context.type';

// ─── Response types ───────────────────────────────────────────────────────────

export interface FixedCostsItemResponse {
  id: string;
  categoryId: string;
  name: string;
  amountCents: number;
  monthlyEquivalentCents: number;
  frequency: string;
  isVariable: boolean;
  dayOfMonth: number | null;
}

export interface FixedCostsGroupResponse {
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  categoryType: string;
  totalCents: number;
  items: FixedCostsItemResponse[];
}

export interface FixedCostsResponse {
  month: string;
  totalCents: number;
  groups: FixedCostsGroupResponse[];
}

export interface CashflowResponse {
  month: string;
  recurringIncomeCents: number;
  recurringExpensesCents: number;
  transactionIncomeCents: number;
  transactionExpensesCents: number;
  totalIncomeCents: number;
  totalExpensesCents: number;
  surplusCents: number;
}

export interface ProjectOverviewItem {
  id: string;
  name: string;
  color: string;
  status: string;
  totalBudgetCents: number | null;
  spentCents: number;
  incomeCents: number;
  balanceCents: number;
  transactionCount: number;
}

export interface ProjectsOverviewResponse {
  projects: ProjectOverviewItem[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Parse 'YYYY-MM' into UTC first and last day of the month as Date objects. */
function parseMonth(ym: string): { firstDay: Date; lastDay: Date } {
  const [year, month] = ym.split('-').map(Number);
  const firstDay = new Date(Date.UTC(year, month - 1, 1));
  const lastDay = new Date(Date.UTC(year, month, 0)); // day 0 of next month = last day of this month
  return { firstDay, lastDay };
}

/** Returns true when a recurring transaction is active during the given month. */
function isActiveInMonth(
  rt: RecurringTransaction,
  firstDay: Date,
  lastDay: Date,
): boolean {
  const start = rt.startDate;
  const end = rt.endDate;
  return start <= lastDay && (end === null || end >= firstDay);
}

/** Returns true when the entry is visible to the requesting user. */
function isVisible(
  entry: { visibility: Visibility; createdByUserId: string | null },
  userId: string,
): boolean {
  return entry.visibility === Visibility.SHARED || entry.createdByUserId === userId;
}

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class OverviewService {
  constructor(private readonly prisma: PrismaService) {}

  // ── 1. Fixed costs ──────────────────────────────────────────────────────────

  async getFixedCosts(
    ctx: RequestContext,
    month?: string,
  ): Promise<FixedCostsResponse> {
    const ym = month ?? currentYearMonth();
    const { firstDay, lastDay } = parseMonth(ym);

    // Load all active recurring transactions with their category
    const rts = await this.prisma.recurringTransaction.findMany({
      where: { householdId: ctx.householdId, isActive: true },
      include: { category: true },
      orderBy: [{ createdAt: 'asc' }],
    });

    // Filter: active in month + visible to requesting user
    const visible = rts.filter(
      (rt) => isActiveInMonth(rt, firstDay, lastDay) && isVisible(rt, ctx.userId),
    );

    // Group by categoryId
    const grouped = new Map<
      string,
      { category: Category; items: (RecurringTransaction & { category: Category })[] }
    >();

    for (const rt of visible) {
      const existing = grouped.get(rt.categoryId);
      if (existing) {
        existing.items.push(rt);
      } else {
        grouped.set(rt.categoryId, { category: rt.category, items: [rt] });
      }
    }

    // Build response groups
    const groups: FixedCostsGroupResponse[] = [];
    for (const { category, items } of grouped.values()) {
      const responseItems: FixedCostsItemResponse[] = items.map((rt) => ({
        id: rt.id,
        categoryId: rt.categoryId,
        name: rt.name,
        amountCents: rt.amountCents,
        monthlyEquivalentCents: toMonthlyEquivalent(
          rt.amountCents,
          rt.frequency as RecurringFrequency,
        ),
        frequency: rt.frequency,
        isVariable: rt.isVariable,
        dayOfMonth: rt.dayOfMonth,
      }));

      const totalCents = responseItems.reduce(
        (sum, i) => sum + i.monthlyEquivalentCents,
        0,
      );

      groups.push({
        categoryId: category.id,
        categoryName: category.name,
        categoryColor: category.color,
        categoryType: category.type,
        totalCents,
        items: responseItems,
      });
    }

    // Sort: INCOME → FIXED_INCOME → EXPENSE, within same type by category.sortOrder
    const typeOrder: Record<string, number> = { INCOME: 0, FIXED_INCOME: 1, EXPENSE: 2 };
    const sortOrderMap = new Map(
      [...grouped.values()].map(({ category }) => [category.id, category.sortOrder]),
    );
    groups.sort((a, b) => {
      const typeDiff = (typeOrder[a.categoryType] ?? 9) - (typeOrder[b.categoryType] ?? 9);
      if (typeDiff !== 0) return typeDiff;
      return (sortOrderMap.get(a.categoryId) ?? 0) - (sortOrderMap.get(b.categoryId) ?? 0);
    });

    const totalCents = groups.reduce((sum, g) => sum + g.totalCents, 0);

    return { month: ym, totalCents, groups };
  }

  // ── 2. Cashflow ─────────────────────────────────────────────────────────────

  async getCashflow(
    ctx: RequestContext,
    month?: string,
  ): Promise<CashflowResponse> {
    const ym = month ?? currentYearMonth();
    const { firstDay, lastDay } = parseMonth(ym);

    // Load active recurring transactions for this household
    const rts = await this.prisma.recurringTransaction.findMany({
      where: { householdId: ctx.householdId, isActive: true },
      orderBy: [{ createdAt: 'asc' }],
    });

    // Load transactions in the month
    const txs = await this.prisma.transaction.findMany({
      where: {
        householdId: ctx.householdId,
        date: { gte: firstDay, lte: lastDay },
      },
      orderBy: [{ date: 'asc' }],
    });

    // Build RecurringEntry list (filter by active in month + visibility)
    const recurringEntries = rts
      .filter((rt) => isActiveInMonth(rt, firstDay, lastDay))
      .map((rt) => ({
        amountCents: rt.amountCents,
        frequency: rt.frequency as RecurringFrequency,
        isVariable: rt.isVariable,
        visibility: rt.visibility,
        createdByUserId: rt.createdByUserId,
      }));

    // Build TransactionEntry list
    const transactionEntries = txs.map((tx) => ({
      amountCents: tx.amountCents,
      visibility: tx.visibility,
      createdByUserId: tx.createdByUserId,
    }));

    const result = calculateMonthlyOverview({
      recurringEntries,
      transactionEntries,
      requestingUserId: ctx.userId,
    });

    return { month: ym, ...result };
  }

  // ── 3. Projects overview ────────────────────────────────────────────────────

  async getProjects(
    ctx: RequestContext,
    status?: string,
  ): Promise<ProjectsOverviewResponse> {
    // Validate status if provided
    const statusFilter =
      status && Object.values(ProjectStatus).includes(status as ProjectStatus)
        ? (status as ProjectStatus)
        : undefined;

    // Load projects visible to the requesting user
    const projects = await this.prisma.project.findMany({
      where: {
        householdId: ctx.householdId,
        ...(statusFilter ? { status: statusFilter } : {}),
        OR: [
          { visibility: Visibility.SHARED },
          { visibility: Visibility.PRIVATE, createdByUserId: ctx.userId },
        ],
      },
      orderBy: [{ name: 'asc' }],
    });

    if (projects.length === 0) {
      return { projects: [] };
    }

    const projectIds = projects.map((p) => p.id);

    // Fetch transaction counts, income totals and expense totals in parallel
    const [countAggs, incomeAggs, expenseAggs] = await Promise.all([
      this.prisma.transaction.groupBy({
        by: ['projectId'],
        where: { householdId: ctx.householdId, projectId: { in: projectIds } },
        _count: { id: true },
      }),
      this.prisma.transaction.groupBy({
        by: ['projectId'],
        where: {
          householdId: ctx.householdId,
          projectId: { in: projectIds },
          amountCents: { gt: 0 },
        },
        _sum: { amountCents: true },
      }),
      this.prisma.transaction.groupBy({
        by: ['projectId'],
        where: {
          householdId: ctx.householdId,
          projectId: { in: projectIds },
          amountCents: { lt: 0 },
        },
        _sum: { amountCents: true },
      }),
    ]);

    const countMap = new Map<string, number>();
    for (const row of countAggs) {
      if (row.projectId !== null) countMap.set(row.projectId, row._count.id);
    }

    const incomeMap = new Map<string, number>();
    for (const row of incomeAggs) {
      if (row.projectId !== null) {
        incomeMap.set(row.projectId, row._sum.amountCents ?? 0);
      }
    }

    const expenseMap = new Map<string, number>();
    for (const row of expenseAggs) {
      if (row.projectId !== null) {
        // Store as positive number (expenses are negative in DB)
        expenseMap.set(row.projectId, Math.abs(row._sum.amountCents ?? 0));
      }
    }

    const result: ProjectOverviewItem[] = projects.map((p: Project) => {
      const incomeCents = incomeMap.get(p.id) ?? 0;
      const spentCents = expenseMap.get(p.id) ?? 0;
      return {
        id: p.id,
        name: p.name,
        color: p.color,
        status: p.status,
        totalBudgetCents: p.totalBudgetCents,
        spentCents,
        incomeCents,
        balanceCents: incomeCents - spentCents,
        transactionCount: countMap.get(p.id) ?? 0,
      };
    });

    return { projects: result };
  }
}
