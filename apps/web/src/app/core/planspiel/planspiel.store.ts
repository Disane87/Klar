import { Injectable, computed, signal } from '@angular/core';
import { calculateMonthlyOverview, type RecurringFrequency, type OverviewResult } from '@klar/shared';

export interface PlanEntry {
  id: string;
  label: string;
  amountCents: number; // signed: positive = income, negative = expense
  frequency: RecurringFrequency;
  color: string; // hex color string for visual grouping
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
