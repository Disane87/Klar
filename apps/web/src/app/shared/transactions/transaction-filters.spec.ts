import { describe, it, expect } from 'vitest';
import {
  EMPTY_FILTERS,
  applyFilters,
  mergeFilters,
  type TransactionFilters,
} from './transaction-filters';
import type { Transaction } from '../../core/transactions/transactions.store';

function tx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'id-' + Math.random(),
    householdId: 'h1',
    categoryId: 'c1',
    projectId: null,
    recurringTransactionId: null,
    amountCents: -1000,
    plannedAmountCents: null,
    isPlanned: false,
    description: 'Edeka Markt',
    counterparty: 'Edeka',
    date: '2026-05-04',
    visibility: 'SHARED',
    color: null,
    icon: null,
    createdAt: '2026-05-04T10:00:00Z',
    source: 'manual',
    bankFieldsLockedAt: null,
    fintsSyncRunId: null,
    accountId: undefined,
    ...overrides,
  };
}

describe('applyFilters', () => {
  const items: Transaction[] = [
    tx({ id: 'a', amountCents: -2500, source: 'fints', recurringTransactionId: 'r1', accountId: 'acc1' }),
    tx({ id: 'b', amountCents:  3000, source: 'manual', counterparty: 'Arbeitgeber GmbH' }),
    tx({ id: 'c', amountCents: -1500, source: 'csv', description: 'Mietzahlung Wohnung' }),
    tx({ id: 'd', amountCents: -800,  source: 'manual', accountId: 'acc1' }),
  ];

  it('returns all items with EMPTY_FILTERS', () => {
    expect(applyFilters(items, EMPTY_FILTERS).map(t => t.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('search matches description (case-fold)', () => {
    const out = applyFilters(items, { ...EMPTY_FILTERS, search: 'MIET' });
    expect(out.map(t => t.id)).toEqual(['c']);
  });

  it('search matches counterparty (case-fold)', () => {
    const out = applyFilters(items, { ...EMPTY_FILTERS, search: 'arbeitgeber' });
    expect(out.map(t => t.id)).toEqual(['b']);
  });

  it('amount filter splits income vs. expense', () => {
    expect(applyFilters(items, { ...EMPTY_FILTERS, amount: 'income' }).map(t => t.id)).toEqual(['b']);
    expect(applyFilters(items, { ...EMPTY_FILTERS, amount: 'expense' }).map(t => t.id)).toEqual(['a', 'c', 'd']);
  });

  it('source filter matches exact source', () => {
    expect(applyFilters(items, { ...EMPTY_FILTERS, source: 'fints' }).map(t => t.id)).toEqual(['a']);
    expect(applyFilters(items, { ...EMPTY_FILTERS, source: 'manual' }).map(t => t.id)).toEqual(['b', 'd']);
  });

  it('recurring filter splits recurring vs. manual', () => {
    expect(applyFilters(items, { ...EMPTY_FILTERS, recurring: 'recurring' }).map(t => t.id)).toEqual(['a']);
    expect(applyFilters(items, { ...EMPTY_FILTERS, recurring: 'manual' }).map(t => t.id)).toEqual(['b', 'c', 'd']);
  });

  it('accountId filter matches exactly', () => {
    expect(applyFilters(items, { ...EMPTY_FILTERS, accountId: 'acc1' }).map(t => t.id)).toEqual(['a', 'd']);
  });

  it('combines multiple filters as AND', () => {
    const out = applyFilters(items, { ...EMPTY_FILTERS, accountId: 'acc1', amount: 'expense', source: 'manual' });
    expect(out.map(t => t.id)).toEqual(['d']);
  });

  it('treats missing source as manual', () => {
    const noSource = [tx({ id: 'x', source: undefined })];
    expect(applyFilters(noSource, { ...EMPTY_FILTERS, source: 'manual' }).map(t => t.id)).toEqual(['x']);
  });
});

describe('mergeFilters', () => {
  it('merges partial filters into base, partial wins', () => {
    const base: TransactionFilters = { ...EMPTY_FILTERS, amount: 'income' };
    const partial: Partial<TransactionFilters> = { accountId: 'acc1' };
    expect(mergeFilters(base, partial)).toEqual({
      ...EMPTY_FILTERS,
      amount: 'income',
      accountId: 'acc1',
    });
  });

  it('returns the base when partial is empty', () => {
    const base: TransactionFilters = { ...EMPTY_FILTERS, search: 'foo' };
    expect(mergeFilters(base, {})).toEqual(base);
  });
});
