import { Injectable, computed, signal } from '@angular/core';
import { calculateMonthlyOverview, type RecurringFrequency, type OverviewResult } from '@klar/shared';

export interface PlanEntry {
  id: string;
  label: string;
  amountCents: number;
  frequency: RecurringFrequency;
  color: string;
  categoryId?: string;
  categoryName?: string;
  categoryType?: string;
  categorySortOrder?: number;
}

@Injectable({ providedIn: 'root' })
export class PlanspielStore {
  readonly entries = signal<PlanEntry[]>([]);

  readonly result = computed<OverviewResult>(() =>
    calculateMonthlyOverview({
      recurringEntries: this.entries().map(e => ({
        amountCents: e.amountCents,
        frequency: e.frequency,
        isVariable: false,
        visibility: 'SHARED' as const,
        createdByUserId: null,
      })),
      transactionEntries: [],
      requestingUserId: '',
    })
  );

  readonly surplusPositive = computed(() => this.result().surplusCents >= 0);
  readonly isEmpty = computed(() => this.entries().length === 0);

  /** Seed entries from Fixkosten data (replaces current entries) */
  loadFromFixkosten(items: { name: string; amountCents: number; monthlyEquivalentCents: number; frequency: RecurringFrequency; categoryId: string; categoryName: string; categoryColor: string; categoryType: string; categorySortOrder: number }[]): void {
    const seeded = items.map(item => ({
      id: crypto.randomUUID(),
      label: item.name,
      amountCents: item.monthlyEquivalentCents,
      frequency: item.frequency,
      color: item.categoryColor,
      categoryId: item.categoryId,
      categoryName: item.categoryName,
      categoryType: item.categoryType,
      categorySortOrder: item.categorySortOrder,
    }));
    this.entries.set(seeded);
  }

  addEntry(entry: Omit<PlanEntry, 'id'>): void {
    this.entries.update(list => [
      ...list,
      { ...entry, id: crypto.randomUUID() },
    ]);
  }

  removeEntry(id: string): void {
    this.entries.update(list => list.filter(e => e.id !== id));
  }

  updateEntry(id: string, patch: Partial<Omit<PlanEntry, 'id'>>): void {
    this.entries.update(list =>
      list.map(e => (e.id === id ? { ...e, ...patch } : e))
    );
  }

  reset(): void {
    this.entries.set([]);
  }
}
