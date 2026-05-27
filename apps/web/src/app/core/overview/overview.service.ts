import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import type { BudgetVsActualRow, RecurringFrequency } from '@klar/shared';

// ─── Response shapes ──────────────────────────────────────────────────────────

export interface FixedCostSplit {
  id: string;
  label: string;
  amountCents: number;
  sortOrder: number;
}

export interface FixedCostItem {
  id: string;
  categoryId: string;
  name: string;
  amountCents: number;
  monthlyEquivalentCents: number;
  frequency: RecurringFrequency;
  isVariable: boolean;
  dayOfMonth: number | null;
  createdBy: string | null;
  createdById: string | null;
  color: string | null;
  icon: string | null;
  splits?: FixedCostSplit[];
  /** Snapshot of GrossToNetInput when this entry was last computed from gross. */
  payrollInput?: Record<string, unknown> | null;
}

export interface FixedCostGroup {
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  categoryIcon: string | null;
  categoryType: string;
  categorySortOrder: number;
  totalCents: number;
  items: FixedCostItem[];
}

export interface FixedCostsOverview {
  month: string;
  totalCents: number;
  groups: FixedCostGroup[];
}

export interface LiquidityUpcomingItem {
  date: string;
  label: string;
  amountCents: number;
  kind: 'fixed-cost' | 'recurring';
}

export interface LiquidityForecast {
  daysRemaining: number;
  currentLiquidityCents: number;
  accountsWithBalance: number;
  accountsTotal: number;
  expectedIncomeRemainingCents: number;
  pendingFixedCostsCents: number;
  variableDailyAvgCents: number;
  variableForecastCents: number;
  forecastEomCents: number;
  comfortZone: 'red' | 'yellow' | 'green';
  upcomingItems: LiquidityUpcomingItem[];
}

export interface CashflowTopMove {
  id: string;
  date: string;
  amountCents: number;
  counterparty: string | null;
  description: string | null;
  transactionKind: string | null;
}

export type CashflowInsightKind =
  | 'transfer-excluded'
  | 'folgelastschrift-spike'
  | 'pace-warn'
  | 'pace-ok';

export interface CashflowInsight {
  kind: CashflowInsightKind;
  label: string;
  detail: string;
  count: number | null;
  amountCents: number | null;
}

export interface CashflowOverview {
  month: string;
  recurringIncomeCents: number;
  recurringExpensesCents: number;
  transactionIncomeCents: number;
  transactionExpensesCents: number;
  totalIncomeCents: number;
  totalExpensesCents: number;
  surplusCents: number;
  /**
   * Day-of-month for the projection anchor — 1..28/29/30/31 for the
   * current month, full daysInMonth value for past months (projection
   * unused there).
   */
  dayOfMonth: number;
  daysInMonth: number;
  /**
   * Linear extrapolation of `surplusCents` to month-end based on the
   * current pace. `null` for past or future months.
   */
  projectedSurplusCents: number | null;
  /** Surplus delta vs. previous month. `null` when there's no prior data. */
  surplusDeltaPrevMonthCents: number | null;
  /** Top 5 most-negative expense rows of the month (TRANSFER excluded). */
  topExpenses: CashflowTopMove[];
  /** Top 3 most-positive income rows of the month (TRANSFER excluded). */
  topIncome: CashflowTopMove[];
  /** Contextual hint cards rendered on the Cashflow page. */
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
  plannedSpentCents: number;
  plannedIncomeCents: number;
  /** Sum of (amountCents - plannedAmountCents) over realized entries that
   *  archive a previous plan. Negative = mehr ausgegeben, positiv = gespart. */
  deviationCents: number;
  transactionCount: number;
}

export interface ProjectsOverview {
  projects: ProjectOverviewItem[];
}

export interface BudgetsVsActualsOverview {
  month: string;
  rows: BudgetVsActualRow[];
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class OverviewService {
  private http = inject(HttpClient);

  private base(householdId: string): string {
    return `/api/v1/households/${householdId}/overview`;
  }

  getFixedCosts(householdId: string, month?: string): Observable<FixedCostsOverview> {
    const params: Record<string, string> = {};
    if (month) params['month'] = month;
    return this.http.get<FixedCostsOverview>(`${this.base(householdId)}/fixed-costs`, { params });
  }

  getCashflow(householdId: string, month?: string): Observable<CashflowOverview> {
    const params: Record<string, string> = {};
    if (month) params['month'] = month;
    return this.http.get<CashflowOverview>(`${this.base(householdId)}/cashflow`, { params });
  }

  getBudgetsVsActuals(
    householdId: string,
    month?: string,
  ): Observable<BudgetsVsActualsOverview> {
    const params: Record<string, string> = {};
    if (month) params['month'] = month;
    return this.http.get<BudgetsVsActualsOverview>(
      `${this.base(householdId)}/budgets-vs-actuals`,
      { params },
    );
  }

  getProjects(householdId: string, status?: string): Observable<ProjectsOverview> {
    const params: Record<string, string> = {};
    if (status) params['status'] = status;
    return this.http.get<ProjectsOverview>(`${this.base(householdId)}/projects`, { params });
  }

  getLiquidityForecast(householdId: string): Observable<LiquidityForecast> {
    return this.http.get<LiquidityForecast>(`${this.base(householdId)}/liquidity`);
  }
}
