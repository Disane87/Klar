import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import type { RecurringFrequency } from '@klar/shared';

// ─── Response shapes ──────────────────────────────────────────────────────────

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
}

export interface FixedCostGroup {
  categoryId: string;
  categoryName: string;
  categoryColor: string;
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

export interface CashflowOverview {
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

  getProjects(householdId: string, status?: string): Observable<ProjectsOverview> {
    const params: Record<string, string> = {};
    if (status) params['status'] = status;
    return this.http.get<ProjectsOverview>(`${this.base(householdId)}/projects`, { params });
  }
}
