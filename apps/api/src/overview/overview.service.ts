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

export interface FixedCostsSplitResponse {
  id: string;
  label: string;
  amountCents: number;
  sortOrder: number;
}

export interface FixedCostsItemResponse {
  id: string;
  categoryId: string;
  name: string;
  amountCents: number;
  monthlyEquivalentCents: number;
  frequency: string;
  isVariable: boolean;
  dayOfMonth: number | null;
  createdBy: string | null;
  createdById: string | null;
  color: string | null;
  icon: string | null;
  /** Optional internal breakdown (e.g. Festgehalt Netto → Brutto + Provision Brutto). */
  splits: FixedCostsSplitResponse[];
}

export interface FixedCostsGroupResponse {
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  categoryIcon: string | null;
  categoryType: string;
  categorySortOrder: number;
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
  /** Sum of planned-only entries (still anticipated, not yet realized). */
  plannedSpentCents: number;
  plannedIncomeCents: number;
  /** Sum of (amountCents - plannedAmountCents) over realized entries that
   *  archive a previous plan — total deviation across the project. */
  deviationCents: number;
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

    // Load all active recurring transactions with category, creator and splits
    const rts = await this.prisma.recurringTransaction.findMany({
      where: { householdId: ctx.householdId, isActive: true },
      include: {
        category: true,
        createdBy: { select: { id: true, displayName: true } },
        splits: { orderBy: { sortOrder: 'asc' } },
      },
      orderBy: [{ createdAt: 'asc' }],
    });

    // Filter: active in month + visible to requesting user
    const visible = rts.filter(
      (rt) => isActiveInMonth(rt, firstDay, lastDay) && isVisible(rt, ctx.userId),
    );

    // Group by categoryId
    const grouped = new Map<
      string,
      { category: Category; items: (RecurringTransaction & { category: Category; createdBy: { id: string; displayName: string } | null; splits: { id: string; label: string; amountCents: number; sortOrder: number }[] })[] }
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
        createdBy: rt.createdBy?.displayName ?? null,
        createdById: rt.createdByUserId ?? null,
        color: rt.color ?? null,
        icon: rt.icon ?? null,
        splits: (rt.splits ?? []).map(s => ({
          id: s.id,
          label: s.label,
          amountCents: s.amountCents,
          sortOrder: s.sortOrder,
        })),
      }));

      const totalCents = responseItems.reduce(
        (sum, i) => sum + i.monthlyEquivalentCents,
        0,
      );

      groups.push({
        categoryId: category.id,
        categoryName: category.name,
        categoryColor: category.color,
        categoryIcon: category.icon ?? null,
        categoryType: category.type,
        categorySortOrder: category.sortOrder,
        totalCents,
        items: responseItems,
      });
    }

    // Sort: INCOME → FIXED_INCOME → EXPENSE, within same type by category.sortOrder
    const typeOrder: Record<string, number> = {
      FIXED_INCOME: 0,
      VARIABLE_INCOME: 1,
      INCOME: 1, // legacy alias
      FIXED_EXPENSE: 2,
      VARIABLE_EXPENSE: 3,
      EXPENSE: 3, // legacy alias
      SAVINGS: 4,
    };
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

    // Load transactions in the month — planned entries don't represent actual
    // cashflow, so they're excluded from the monthly cashflow calculation.
    const txs = await this.prisma.transaction.findMany({
      where: {
        householdId: ctx.householdId,
        date: { gte: firstDay, lte: lastDay },
        isPlanned: false,
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

    // Load all transactions for these projects (small set; cheaper to aggregate
    // in JS than to issue 5 separate groupBy queries split by sign + isPlanned).
    const txs = await this.prisma.transaction.findMany({
      where: { householdId: ctx.householdId, projectId: { in: projectIds } },
      select: {
        projectId: true,
        amountCents: true,
        plannedAmountCents: true,
        isPlanned: true,
      },
    });

    type Agg = {
      count: number;
      realizedIncome: number;
      realizedSpent: number;
      plannedIncome: number;
      plannedSpent: number;
      deviation: number;
    };
    const aggMap = new Map<string, Agg>();
    const blank = (): Agg => ({
      count: 0,
      realizedIncome: 0,
      realizedSpent: 0,
      plannedIncome: 0,
      plannedSpent: 0,
      deviation: 0,
    });

    for (const tx of txs) {
      if (!tx.projectId) continue;
      const a = aggMap.get(tx.projectId) ?? blank();
      a.count += 1;
      if (tx.isPlanned) {
        if (tx.amountCents > 0) a.plannedIncome += tx.amountCents;
        else                    a.plannedSpent  += Math.abs(tx.amountCents);
      } else {
        if (tx.amountCents > 0) a.realizedIncome += tx.amountCents;
        else                    a.realizedSpent  += Math.abs(tx.amountCents);
        if (tx.plannedAmountCents !== null) {
          a.deviation += tx.amountCents - tx.plannedAmountCents;
        }
      }
      aggMap.set(tx.projectId, a);
    }

    const result: ProjectOverviewItem[] = projects.map((p: Project) => {
      const a = aggMap.get(p.id) ?? blank();
      return {
        id: p.id,
        name: p.name,
        color: p.color,
        status: p.status,
        totalBudgetCents: p.totalBudgetCents,
        spentCents:        a.realizedSpent,
        incomeCents:       a.realizedIncome,
        balanceCents:      a.realizedIncome - a.realizedSpent,
        plannedSpentCents: a.plannedSpent,
        plannedIncomeCents: a.plannedIncome,
        deviationCents:    a.deviation,
        transactionCount:  a.count,
      };
    });

    return { projects: result };
  }
}
