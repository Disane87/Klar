import type { Transaction } from '../../core/transactions/transactions.store';

export type AmountFilter = 'all' | 'income' | 'expense';
export type SourceFilter = 'all' | 'fints' | 'manual' | 'csv' | 'csv-import';
export type RecurringFilter = 'all' | 'recurring' | 'manual';

export interface TransactionFilters {
  search: string;
  accountId: string | null;
  categoryId: string | null;
  source: SourceFilter;
  amount: AmountFilter;
  recurring: RecurringFilter;
  /** Raw bookingText (case-insensitive equality). null = no filter. */
  bookingText: string | null;
}

export const EMPTY_FILTERS: TransactionFilters = {
  search: '',
  accountId: null,
  categoryId: null,
  source: 'all',
  amount: 'all',
  recurring: 'all',
  bookingText: null,
};

export function mergeFilters(
  base: TransactionFilters,
  partial: Partial<TransactionFilters>,
): TransactionFilters {
  return { ...base, ...partial };
}

export function applyFilters(
  items: readonly Transaction[],
  filters: TransactionFilters,
): Transaction[] {
  const q = filters.search.trim().toLowerCase();
  return items.filter(t => {
    if (q) {
      const haystack = `${t.description ?? ''} ${t.counterparty ?? ''}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (filters.accountId && t.accountId !== filters.accountId) return false;
    if (filters.categoryId && t.categoryId !== filters.categoryId) return false;
    if (filters.source !== 'all' && (t.source ?? 'manual') !== filters.source) return false;
    if (filters.amount === 'income' && t.amountCents <= 0) return false;
    if (filters.amount === 'expense' && t.amountCents >= 0) return false;
    if (filters.recurring === 'recurring' && !t.recurringTransactionId) return false;
    if (filters.recurring === 'manual' && !!t.recurringTransactionId) return false;
    if (filters.bookingText) {
      const v = t.bookingText?.trim().toLowerCase() ?? '';
      if (v !== filters.bookingText.trim().toLowerCase()) return false;
    }
    return true;
  });
}
