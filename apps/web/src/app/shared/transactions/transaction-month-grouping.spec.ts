import { describe, it, expect } from 'vitest';
import { groupByMonth } from './transaction-month-grouping';
import type { Transaction } from '../../core/transactions/transactions.store';

function tx(date: string, amountCents: number, id = date + '_' + amountCents): Transaction {
  return {
    id, householdId: 'h1', categoryId: 'c1', projectId: null,
    recurringTransactionId: null, amountCents, plannedAmountCents: null,
    isPlanned: false, description: 'x', counterparty: null,
    date, visibility: 'SHARED', color: null, icon: null,
    createdAt: date + 'T10:00:00Z', source: 'manual',
    bankFieldsLockedAt: null, fintsSyncRunId: null,
  };
}

describe('groupByMonth', () => {
  it('returns empty array for empty input', () => {
    expect(groupByMonth([])).toEqual([]);
  });

  it('groups by YYYY-MM, newest month first', () => {
    const items = [
      tx('2026-03-15', -100),
      tx('2026-05-04', -200),
      tx('2026-04-20', -300),
    ];
    const groups = groupByMonth(items);
    expect(groups.map(g => g.key)).toEqual(['2026-05', '2026-04', '2026-03']);
  });

  it('sorts items within a month newest first', () => {
    const items = [
      tx('2026-05-01', -10, 'a'),
      tx('2026-05-15', -20, 'b'),
      tx('2026-05-10', -30, 'c'),
    ];
    const groups = groupByMonth(items);
    expect(groups[0].items.map(t => t.id)).toEqual(['b', 'c', 'a']);
  });

  it('computes per-month totalCents', () => {
    const items = [
      tx('2026-05-01',  3000),
      tx('2026-05-15', -1200),
      tx('2026-04-10', -500),
    ];
    const groups = groupByMonth(items);
    expect(groups[0].totalCents).toBe(1800);
    expect(groups[1].totalCents).toBe(-500);
  });

  it('formats label in German long month + year', () => {
    const groups = groupByMonth([tx('2026-05-04', -100)]);
    expect(groups[0].label).toMatch(/^Mai\s+2026$/);
  });

  it('itemsCount equals items.length', () => {
    const groups = groupByMonth([tx('2026-05-01', -10), tx('2026-05-02', -20)]);
    expect(groups[0].itemsCount).toBe(2);
  });
});
