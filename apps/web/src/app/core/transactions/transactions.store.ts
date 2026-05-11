import { Injectable, computed, inject, resource, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { currentYearMonth } from '@klar/shared';
import { HouseholdStore } from '../household/household.store';

export interface Transaction {
  id: string;
  householdId: string;
  /** FinTS Foundation (14a.8): Account this booking belongs to. */
  accountId?: string;
  categoryId: string | null;
  projectId: string | null;
  recurringTransactionId: string | null;
  amountCents: number;
  plannedAmountCents: number | null;
  isPlanned: boolean;
  description: string;
  counterparty: string | null;
  date: string; // YYYY-MM-DD
  visibility: 'SHARED' | 'PRIVATE';
  /** Optional per-transaction override; UI falls back to category color/icon when null. */
  color: string | null;
  icon: string | null;
  createdAt: string;
  /** FinTS Foundation (14a.8): origin classifier. */
  source?: 'manual' | 'csv' | 'fints';
  /** Phase 14b: booking-type classifier from FinTS GVC (drives the type chip). */
  transactionKind?:
    | 'STANDING_ORDER'
    | 'DIRECT_DEBIT'
    | 'TRANSFER'
    | 'CARD'
    | 'FEE'
    | 'OTHER'
    | null;
  /** Raw bank label (e.g. "FOLGELASTSCHRIFT", "BARGELDAUSZAHLUNG GA"); null when unknown. */
  bookingText?: string | null;
  /** Set when the booking came from FinTS — UI must render bank fields read-only. */
  bankFieldsLockedAt?: string | null;
  /** FK to FintsSyncRun (read-only on the FE). */
  fintsSyncRunId?: string | null;
}

@Injectable({ providedIn: 'root' })
export class TransactionsStore {
  private http = inject(HttpClient);
  private householdStore = inject(HouseholdStore);

  readonly currentMonth = signal(currentYearMonth());
  readonly categoryFilter = signal<string | null>(null);
  readonly projectFilter = signal<string | null>(null);
  /**
   * When set, the store loads ALL transactions for that account regardless of
   * month (historical account view). When null, the store stays month-scoped.
   */
  readonly accountIdFilter = signal<string | null>(null);

  private _resource = resource<
    Transaction[],
    {
      householdId: string | null;
      month: string;
      categoryId: string | null;
      projectId: string | null;
      accountId: string | null;
    }
  >({
    params: () => ({
      householdId: this.householdStore.activeId(),
      month: this.currentMonth(),
      categoryId: this.categoryFilter(),
      projectId: this.projectFilter(),
      accountId: this.accountIdFilter(),
    }),
    loader: ({ params }) => {
      if (!params.householdId) return Promise.resolve([]);
      const queryParams: Record<string, string> = {};
      if (params.accountId) {
        queryParams['accountId'] = params.accountId;
      } else {
        queryParams['month'] = params.month;
      }
      if (params.categoryId) queryParams['categoryId'] = params.categoryId;
      if (params.projectId) queryParams['projectId'] = params.projectId;
      return firstValueFrom(
        this.http.get<Transaction[]>(
          `/api/v1/households/${params.householdId}/transactions`,
          { params: queryParams },
        ),
      );
    },
  });

  readonly items = this._resource.value;
  readonly loading = this._resource.isLoading;
  readonly error = this._resource.error;
  readonly isEmpty = computed(() => (this.items()?.length ?? 0) === 0);

  readonly sortedItems = computed(() => {
    const list = this.items() ?? [];
    return [...list].sort((a, b) => b.date.localeCompare(a.date));
  });

  readonly totalIncomeCents = computed(() =>
    (this.items() ?? [])
      .filter(t => !t.isPlanned && t.amountCents > 0)
      .reduce((s, t) => s + t.amountCents, 0),
  );

  readonly totalExpenseCents = computed(() =>
    (this.items() ?? [])
      .filter(t => !t.isPlanned && t.amountCents < 0)
      .reduce((s, t) => s + t.amountCents, 0),
  );

  readonly nettoCents = computed(
    () => this.totalIncomeCents() + this.totalExpenseCents(),
  );

  setMonth(month: string): void {
    this.currentMonth.set(month);
  }

  clearFilters(): void {
    this.categoryFilter.set(null);
    this.projectFilter.set(null);
  }

  setAccountIdFilter(accountId: string | null): void {
    this.accountIdFilter.set(accountId);
  }

  reload(): void {
    this._resource.reload();
  }
}
