import { Injectable } from '@nestjs/common';
import type { Category, Project, RecurringTransaction, Transaction } from '@prisma/client';
import { FixedCostStatus, ProjectStatus, Visibility } from '@prisma/client';
import type { BudgetVsActualRow, RecurringFrequency } from '@klar/shared';
import {
  budgetsVsActuals,
  calculateMonthlyOverview,
  currentYearMonth,
  safeDayOfMonth,
  toMonthlyEquivalent,
} from '@klar/shared';
import { PrismaService } from '../prisma/prisma.service';
import type { RequestContext } from '../common/types/request-context.type';

/**
 * Pretty-printed signed-Euro string for embedding inside insight detail
 * strings (UI doesn't have a money pipe in plain text — backend formats).
 */
function formatSignedEuro(cents: number): string {
  const sign = cents > 0 ? '+' : cents < 0 ? '−' : '';
  const abs = Math.abs(cents) / 100;
  return `${sign}${abs.toFixed(2).replace('.', ',')} €`;
}

/** Midnight UTC of the given Date — used as a stable "today" anchor. */
function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** 23:59:59.999 UTC of the last day of `anchor`'s month. */
function endOfCurrentUtcMonth(anchor: Date): Date {
  return new Date(Date.UTC(
    anchor.getUTCFullYear(),
    anchor.getUTCMonth() + 1,
    0, 23, 59, 59, 999,
  ));
}

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
  /** Snapshot of GrossToNetInput when this entry was last computed from gross. */
  payrollInput: Record<string, unknown> | null;
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

export interface CashflowTopMove {
  id: string;
  date: string;
  amountCents: number;
  counterparty: string | null;
  description: string | null;
  transactionKind: string | null;
}

export interface CashflowInsight {
  kind: 'transfer-excluded' | 'folgelastschrift-spike' | 'pace-warn' | 'pace-ok';
  label: string;
  detail: string;
  count: number | null;
  amountCents: number | null;
}

export interface LiquidityUpcomingItem {
  date: string;
  label: string;
  amountCents: number;
  kind: 'fixed-cost' | 'recurring';
}

export interface LiquidityForecast {
  /** Days from "today" (inclusive) to the end of the current month. */
  daysRemaining: number;
  /** Sum of `lastKnownBalanceCents` across accessible accounts. */
  currentLiquidityCents: number;
  /** How many accounts contributed an actual balance vs. were skipped (null balance). */
  accountsWithBalance: number;
  /** Total accessible accounts (including those without balance). */
  accountsTotal: number;
  /** Sum of recurring income items whose next due-date is in (today, EOM]. */
  expectedIncomeRemainingCents: number;
  /** Sum of `CONFIRMED` fixed costs whose nextRenewalAt is in (today, EOM]. Positive cents. */
  pendingFixedCostsCents: number;
  /** Average daily variable spend over the last 30 days, in positive cents. */
  variableDailyAvgCents: number;
  /** `variableDailyAvgCents × daysRemaining`, rounded. Positive cents. */
  variableForecastCents: number;
  /**
   * The bottom line: currentLiquidity + expectedIncome − pendingFixed −
   * variableForecast. Signed cents — can go negative.
   */
  forecastEomCents: number;
  /** UI tone: red <0, yellow <500€, green ≥500€. */
  comfortZone: 'red' | 'yellow' | 'green';
  /** Anything fällig in the next 7 days. */
  upcomingItems: LiquidityUpcomingItem[];
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
  dayOfMonth: number;
  daysInMonth: number;
  projectedSurplusCents: number | null;
  surplusDeltaPrevMonthCents: number | null;
  topExpenses: CashflowTopMove[];
  topIncome: CashflowTopMove[];
  insights: CashflowInsight[];
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

export interface BudgetsVsActualsResponse {
  month: string;
  rows: BudgetVsActualRow[];
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
        payrollInput: (rt.payrollInput as Record<string, unknown> | null) ?? null,
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

    // Build TransactionEntry list. `transactionKind` flows through so
    // own-account transfers (kind = TRANSFER) drop out of cashflow totals
    // in calculateMonthlyOverview.
    const transactionEntries = txs.map((tx) => ({
      amountCents: tx.amountCents,
      visibility: tx.visibility,
      createdByUserId: tx.createdByUserId,
      transactionKind: tx.transactionKind,
    }));

    const result = calculateMonthlyOverview({
      recurringEntries,
      transactionEntries,
      requestingUserId: ctx.userId,
    });

    // ── Insights (Phase 2 of cashflow redesign) ───────────────────────────
    const insights = await this.computeCashflowInsights({
      ctx,
      ym,
      firstDay,
      lastDay,
      txs,
      surplusCents: result.surplusCents,
    });

    return { month: ym, ...result, ...insights };
  }

  /**
   * Computes month-pacing projection, prev-month delta, top moves and
   * contextual hint cards for the Cashflow page redesign. Pure-ish — pulls
   * only the prev-month surplus and previous-month Folgelastschrift count
   * for comparisons, otherwise works off `txs` already loaded above.
   */
  private async computeCashflowInsights(args: {
    ctx: RequestContext;
    ym: string;
    firstDay: Date;
    lastDay: Date;
    txs: Array<{
      id: string;
      date: Date;
      amountCents: number;
      counterparty: string | null;
      description: string | null;
      transactionKind: string | null;
      visibility: 'PRIVATE' | 'SHARED';
      createdByUserId: string | null;
    }>;
    surplusCents: number;
  }): Promise<{
    dayOfMonth: number;
    daysInMonth: number;
    projectedSurplusCents: number | null;
    surplusDeltaPrevMonthCents: number | null;
    topExpenses: CashflowTopMove[];
    topIncome: CashflowTopMove[];
    insights: CashflowInsight[];
  }> {
    const { ctx, ym, firstDay, lastDay, txs, surplusCents } = args;
    const daysInMonth = lastDay.getUTCDate();
    const today = new Date();
    const isCurrentMonth =
      today.getUTCFullYear() === firstDay.getUTCFullYear() &&
      today.getUTCMonth() === firstDay.getUTCMonth();
    const dayOfMonth = isCurrentMonth ? today.getUTCDate() : daysInMonth;

    // Linear projection: scale the current surplus to the full month.
    // Only meaningful for the current month — past months are already final;
    // future months have no data to extrapolate from.
    const projectedSurplusCents =
      isCurrentMonth && dayOfMonth > 0
        ? Math.round((surplusCents * daysInMonth) / dayOfMonth)
        : null;

    // Privacy filter mirrors calculateMonthlyOverview: PRIVATE rows from
    // other users never enter cashflow numbers or move-list either.
    const isVisible = (tx: { visibility: 'PRIVATE' | 'SHARED'; createdByUserId: string | null }) =>
      tx.visibility === 'SHARED' || tx.createdByUserId === ctx.userId;

    const cashflowTxs = txs.filter(
      t => isVisible(t) && t.transactionKind !== 'TRANSFER',
    );

    const toMove = (t: typeof cashflowTxs[number]): CashflowTopMove => ({
      id: t.id,
      date: t.date.toISOString().slice(0, 10),
      amountCents: t.amountCents,
      counterparty: t.counterparty,
      description: t.description,
      transactionKind: t.transactionKind,
    });

    const topExpenses = cashflowTxs
      .filter(t => t.amountCents < 0)
      .sort((a, b) => a.amountCents - b.amountCents) // most negative first
      .slice(0, 5)
      .map(toMove);

    const topIncome = cashflowTxs
      .filter(t => t.amountCents > 0)
      .sort((a, b) => b.amountCents - a.amountCents) // most positive first
      .slice(0, 3)
      .map(toMove);

    // Prev-month surplus for the delta hint. Reuse the same scoping
    // (PRIVATE filter, TRANSFER exclusion) so the comparison is fair.
    const prevFirstDay = new Date(Date.UTC(
      firstDay.getUTCFullYear(),
      firstDay.getUTCMonth() - 1,
      1,
    ));
    const prevLastDay = new Date(Date.UTC(
      firstDay.getUTCFullYear(),
      firstDay.getUTCMonth(),
      0, // last day of previous month
      23, 59, 59,
    ));
    const prevTxs = await this.prisma.transaction.findMany({
      where: {
        householdId: ctx.householdId,
        date: { gte: prevFirstDay, lte: prevLastDay },
        isPlanned: false,
      },
      select: {
        amountCents: true,
        visibility: true,
        createdByUserId: true,
        transactionKind: true,
        description: true,
      },
    });
    const prevSurplusCents = prevTxs
      .filter(t => isVisible(t) && t.transactionKind !== 'TRANSFER')
      .reduce((s, t) => s + t.amountCents, 0);
    const surplusDeltaPrevMonthCents =
      prevTxs.length === 0 ? null : surplusCents - prevSurplusCents;

    // ── Insight cards ───────────────────────────────────────────────────
    const insights: CashflowInsight[] = [];

    // 1. TRANSFER-exclusion: did we drop bookings out of the cashflow?
    const transferTxs = txs.filter(t => isVisible(t) && t.transactionKind === 'TRANSFER');
    const transferIncomeCents = transferTxs
      .filter(t => t.amountCents > 0)
      .reduce((s, t) => s + t.amountCents, 0);
    const transferExpenseCents = transferTxs
      .filter(t => t.amountCents < 0)
      .reduce((s, t) => s + t.amountCents, 0);
    if (transferTxs.length > 0) {
      const sign = transferIncomeCents + transferExpenseCents;
      insights.push({
        kind: 'transfer-excluded',
        label: 'Eigene Überträge',
        detail:
          `${transferTxs.length} ${transferTxs.length === 1 ? 'Buchung' : 'Buchungen'} ` +
          `mit „Übertrag" wurden aus dem Cashflow ausgenommen ` +
          `(Netto ${formatSignedEuro(sign)}).`,
        count: transferTxs.length,
        amountCents: sign,
      });
    }

    // 2. Folgelastschrift-spike: count vs. prev month. Folgelastschriften
    // are retried direct-debits — a sudden spike indicates payment issues
    // (failed cards, insufficient funds the first time round).
    const isFolgelast = (desc: string | null) =>
      !!desc && /folgelastschrift/i.test(desc);
    const flCount = cashflowTxs.filter(t => isFolgelast(t.description)).length;
    const prevFlCount = prevTxs.filter(
      t => isVisible(t) && t.transactionKind !== 'TRANSFER' && isFolgelast(t.description),
    ).length;
    if (flCount >= 3 && flCount >= prevFlCount * 2) {
      insights.push({
        kind: 'folgelastschrift-spike',
        label: 'Folgelastschriften häufen sich',
        detail:
          `${flCount} Folgelastschriften in diesem Monat ` +
          (prevFlCount > 0 ? `(Vormonat: ${prevFlCount}). ` : '(keine im Vormonat). ') +
          'Eine Folgelastschrift ist eine wiederholt eingereichte Lastschrift — ' +
          'die erste ist meist mangels Deckung oder durch Widerruf gescheitert.',
        count: flCount,
        amountCents: null,
      });
    }

    // 3. Pacing-Warning vs. -OK based on projection. Only fires when
    // we have a projection (current month) and it's measurably different
    // from a flat "first-day surplus" extrapolation.
    if (projectedSurplusCents !== null && dayOfMonth >= 3) {
      const pacingDelta = projectedSurplusCents - surplusCents;
      // Only warn when projection points clearly negative AND the gap to
      // today is substantial (>500€ further into the red).
      if (projectedSurplusCents < -50_00 && pacingDelta < -50000) {
        insights.push({
          kind: 'pace-warn',
          label: 'Hochrechnung warnt',
          detail:
            `Bei aktuellem Tempo schließt der Monat bei ${formatSignedEuro(projectedSurplusCents)} ` +
            `(${formatSignedEuro(pacingDelta)} weiter ins Minus als heute).`,
          count: null,
          amountCents: projectedSurplusCents,
        });
      } else if (projectedSurplusCents >= 0 && surplusCents < 0) {
        insights.push({
          kind: 'pace-ok',
          label: 'Hochrechnung im Plus',
          detail: `Bei aktuellem Tempo dreht der Monat noch auf ${formatSignedEuro(projectedSurplusCents)}.`,
          count: null,
          amountCents: projectedSurplusCents,
        });
      }
    }

    void ym; // silence unused for now — kept for future month-name labels

    return {
      dayOfMonth,
      daysInMonth,
      projectedSurplusCents,
      surplusDeltaPrevMonthCents,
      topExpenses,
      topIncome,
      insights,
    };
  }

  // ── 2b. Liquidity forecast ─────────────────────────────────────────────────

  /**
   * "Komme ich bis Monatsende hin?" — single-question dashboard for the
   * Cashflow page. Aggregates current account balances, recurring income
   * still expected this month, pending fixed costs and a pace-based
   * variable-spend forecast into one bottom-line number.
   *
   * Privacy: includes SHARED accounts/recurring + the requesting user's
   * own PRIVATE ones. Other household members' PRIVATE rows never enter.
   */
  async getLiquidityForecast(ctx: RequestContext): Promise<LiquidityForecast> {
    const today = startOfUtcDay(new Date());
    const eom = endOfCurrentUtcMonth(today);
    // Inclusive day count: today and EOM both contribute one full day
    // each to the projection (typical "Ende des Monats reichts noch X
    // Tage Ausgaben" intuition).
    const daysRemaining = Math.max(
      1,
      Math.round((eom.getTime() - today.getTime()) / 86_400_000) + 1,
    );

    // 1. Current liquidity ---------------------------------------------------
    const accounts = await this.prisma.account.findMany({
      where: {
        householdId: ctx.householdId,
        archivedAt: null,
        OR: [
          { visibility: Visibility.SHARED },
          { visibility: Visibility.PRIVATE, ownerId: ctx.userId },
        ],
      },
      select: { id: true, lastKnownBalanceCents: true },
    });
    const accountsWithBalance = accounts.filter(
      a => a.lastKnownBalanceCents !== null,
    ).length;
    const currentLiquidityCents = accounts.reduce(
      (s, a) => s + (a.lastKnownBalanceCents ?? 0),
      0,
    );

    // 2. Recurring contribution remaining ------------------------------------
    const rts = await this.prisma.recurringTransaction.findMany({
      where: {
        householdId: ctx.householdId,
        isActive: true,
        OR: [
          { visibility: Visibility.SHARED },
          { visibility: Visibility.PRIVATE, createdByUserId: ctx.userId },
        ],
      },
    });
    let expectedIncomeRemainingCents = 0;
    for (const rt of rts) {
      if (rt.amountCents <= 0) continue;
      if (rt.frequency !== 'MONTHLY') continue; // v1: monthly income only
      const dom = rt.dayOfMonth ?? 1;
      const due = safeDayOfMonth(today.getUTCFullYear(), today.getUTCMonth() + 1, dom);
      if (due >= today.getUTCDate()) expectedIncomeRemainingCents += rt.amountCents;
    }

    // 3. Pending fixed costs in [today, EOM] ---------------------------------
    const fixedCosts = await this.prisma.fixedCost.findMany({
      where: {
        householdId: ctx.householdId,
        status: FixedCostStatus.CONFIRMED,
        nextRenewalAt: { gte: today, lte: eom },
      },
    });
    const pendingFixedCostsCents = fixedCosts.reduce(
      (s, fc) => s + Math.abs(fc.amountCents),
      0,
    );

    // 4. Variable spend forecast --------------------------------------------
    // Last 30 days of ad-hoc, expense-side, non-TRANSFER, non-recurring-
    // linked transactions. Excluding `recurringTransactionId != null` so
    // we don't double-count recurring items already in the income/fixed
    // sides of the forecast.
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 86_400_000);
    const variableTxs = await this.prisma.transaction.findMany({
      where: {
        householdId: ctx.householdId,
        date: { gte: thirtyDaysAgo, lte: today },
        isPlanned: false,
        amountCents: { lt: 0 },
        recurringTransactionId: null,
        NOT: { transactionKind: 'TRANSFER' },
        OR: [
          { visibility: Visibility.SHARED },
          { visibility: Visibility.PRIVATE, createdByUserId: ctx.userId },
        ],
      },
      select: { amountCents: true },
    });
    const variableSpent30dCents = variableTxs.reduce(
      (s, t) => s + Math.abs(t.amountCents),
      0,
    );
    const variableDailyAvgCents = Math.round(variableSpent30dCents / 30);
    const variableForecastCents = Math.round(variableDailyAvgCents * daysRemaining);

    // 5. Bottom line --------------------------------------------------------
    const forecastEomCents =
      currentLiquidityCents +
      expectedIncomeRemainingCents -
      pendingFixedCostsCents -
      variableForecastCents;

    let comfortZone: 'red' | 'yellow' | 'green';
    if (forecastEomCents < 0) comfortZone = 'red';
    else if (forecastEomCents < 50000) comfortZone = 'yellow';
    else comfortZone = 'green';

    // 6. Upcoming 7 days ----------------------------------------------------
    const sevenDaysOut = new Date(today.getTime() + 7 * 86_400_000);
    const upcomingItems: LiquidityUpcomingItem[] = [];
    for (const fc of fixedCosts) {
      if (!fc.nextRenewalAt) continue;
      if (fc.nextRenewalAt.getTime() > sevenDaysOut.getTime()) continue;
      upcomingItems.push({
        date: fc.nextRenewalAt.toISOString().slice(0, 10),
        label: fc.name,
        amountCents: -Math.abs(fc.amountCents),
        kind: 'fixed-cost',
      });
    }
    for (const rt of rts) {
      if (rt.frequency !== 'MONTHLY' || rt.dayOfMonth === null) continue;
      const day = safeDayOfMonth(
        today.getUTCFullYear(),
        today.getUTCMonth() + 1,
        rt.dayOfMonth,
      );
      const dueDate = new Date(
        Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), day),
      );
      if (
        dueDate.getTime() >= today.getTime() &&
        dueDate.getTime() <= sevenDaysOut.getTime()
      ) {
        upcomingItems.push({
          date: dueDate.toISOString().slice(0, 10),
          label: rt.name,
          amountCents: rt.amountCents,
          kind: 'recurring',
        });
      }
    }
    upcomingItems.sort((a, b) =>
      a.date < b.date ? -1 : a.date > b.date ? 1 : a.label.localeCompare(b.label),
    );

    return {
      daysRemaining,
      currentLiquidityCents,
      accountsWithBalance,
      accountsTotal: accounts.length,
      expectedIncomeRemainingCents,
      pendingFixedCostsCents,
      variableDailyAvgCents,
      variableForecastCents,
      forecastEomCents,
      comfortZone,
      upcomingItems,
    };
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

  // ── 4. Budgets vs. Actuals ──────────────────────────────────────────────────

  async getBudgetsVsActuals(
    ctx: RequestContext,
    month?: string,
  ): Promise<BudgetsVsActualsResponse> {
    const ym = month ?? currentYearMonth();
    const { firstDay, lastDay } = parseMonth(ym);

    // 1. Load budgets for the month + their categories so we can sign Soll
    //    correctly (expense categories → negative).
    const budgetMonth = new Date(Date.UTC(firstDay.getUTCFullYear(), firstDay.getUTCMonth(), 1));
    const budgetRows = await this.prisma.budget.findMany({
      where: { householdId: ctx.householdId, month: budgetMonth },
      include: { category: true },
    });

    if (budgetRows.length === 0) {
      return { month: ym, rows: [] };
    }

    const expenseTypes = new Set(['FIXED_EXPENSE', 'VARIABLE_EXPENSE', 'EXPENSE', 'SAVINGS']);
    const isExpenseCategory = (type: string): boolean => expenseTypes.has(type);

    const budgets = budgetRows.map((b) => ({
      categoryId: b.categoryId,
      // Stored as positive integer; sign it according to category type.
      sollCents: isExpenseCategory(b.category.type) ? -b.amountCents : b.amountCents,
    }));

    const categoryIds = budgetRows.map((b) => b.categoryId);

    // 2. Sum realized transactions in the month per category (visible to user).
    const txs = await this.prisma.transaction.findMany({
      where: {
        householdId: ctx.householdId,
        date: { gte: firstDay, lte: lastDay },
        isPlanned: false,
        categoryId: { in: categoryIds },
      },
      select: {
        categoryId: true,
        amountCents: true,
        visibility: true,
        createdByUserId: true,
      },
    });

    const actualsByCat = new Map<string, number>();
    for (const tx of txs) {
      if (!tx.categoryId) continue;
      if (!isVisible(tx, ctx.userId)) continue;
      actualsByCat.set(
        tx.categoryId,
        (actualsByCat.get(tx.categoryId) ?? 0) + tx.amountCents,
      );
    }

    // 3. Add active recurring transactions expanded to monthly equivalent.
    const rts = await this.prisma.recurringTransaction.findMany({
      where: {
        householdId: ctx.householdId,
        isActive: true,
        categoryId: { in: categoryIds },
      },
    });

    for (const rt of rts) {
      if (!isActiveInMonth(rt, firstDay, lastDay)) continue;
      if (!isVisible(rt, ctx.userId)) continue;
      const monthly = toMonthlyEquivalent(rt.amountCents, rt.frequency as RecurringFrequency);
      actualsByCat.set(
        rt.categoryId,
        (actualsByCat.get(rt.categoryId) ?? 0) + monthly,
      );
    }

    const actuals = Array.from(actualsByCat.entries()).map(([categoryId, istCents]) => ({
      categoryId,
      istCents,
    }));

    const rows = budgetsVsActuals({ budgets, actuals });

    return { month: ym, rows };
  }
}
