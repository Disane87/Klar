import { describe, it, expect } from 'vitest';
import {
  predicateSchema,
  aggregationSpecSchema,
  scheduleSchema,
} from './predicate-types';

describe('predicateSchema', () => {
  it('accepts a simple cmp predicate', () => {
    const ok = predicateSchema.safeParse({
      op: 'cmp',
      field: 'amountCents',
      operator: '>',
      value: 100,
    });
    expect(ok.success).toBe(true);
  });

  it('accepts nested and/or/not', () => {
    const ok = predicateSchema.safeParse({
      op: 'and',
      clauses: [
        { op: 'cmp', field: 'a', operator: '=', value: 1 },
        { op: 'not', clause: { op: 'cmp', field: 'b', operator: '!=', value: 2 } },
      ],
    });
    expect(ok.success).toBe(true);
  });

  it('rejects an unknown op', () => {
    const bad = predicateSchema.safeParse({ op: 'maybe', field: 'a', operator: '=', value: 1 });
    expect(bad.success).toBe(false);
  });

  it('rejects an unknown operator', () => {
    const bad = predicateSchema.safeParse({
      op: 'cmp',
      field: 'a',
      operator: '<<',
      value: 1,
    });
    expect(bad.success).toBe(false);
  });

  it('rejects empty and clauses', () => {
    const bad = predicateSchema.safeParse({ op: 'and', clauses: [] });
    expect(bad.success).toBe(false);
  });

  it('accepts an aggregation value', () => {
    const ok = predicateSchema.safeParse({
      op: 'cmp',
      field: 'amountCents',
      operator: '>',
      value: {
        aggregation: { type: 'accountBalance', accountId: 'acc_1' },
      },
    });
    expect(ok.success).toBe(true);
  });
});

describe('aggregationSpecSchema', () => {
  it('accepts every documented aggregation type', () => {
    const cases = [
      { type: 'accountBalance', accountId: 'acc_1' },
      { type: 'sumAmount', window: 'last30d', kind: 'expense' },
      { type: 'countTransactions', window: 'thisMonth' },
      { type: 'budgetUsedPct', categoryId: 'cat_1' },
      { type: 'upcomingStandingOrdersSum', days: 7 },
      { type: 'upcomingStandingOrdersCount', days: 7 },
    ];
    for (const c of cases) {
      const ok = aggregationSpecSchema.safeParse(c);
      expect(ok.success, `expected ${JSON.stringify(c)} to parse`).toBe(true);
    }
  });

  it('rejects unknown aggregation types', () => {
    const bad = aggregationSpecSchema.safeParse({ type: 'fancyMath' });
    expect(bad.success).toBe(false);
  });

  it('clamps customDays days to a positive integer', () => {
    const bad = aggregationSpecSchema.safeParse({
      type: 'sumAmount',
      window: 'customDays',
      days: -5,
    });
    expect(bad.success).toBe(false);
  });
});

describe('scheduleSchema', () => {
  it('accepts a daily schedule', () => {
    expect(scheduleSchema.safeParse({ type: 'daily', time: '08:00' }).success).toBe(true);
  });

  it('requires dayOfWeek for weekly', () => {
    expect(scheduleSchema.safeParse({ type: 'weekly', time: '08:00' }).success).toBe(false);
    expect(
      scheduleSchema.safeParse({ type: 'weekly', time: '08:00', dayOfWeek: 1 }).success,
    ).toBe(true);
  });

  it('requires dayOfMonth for monthly', () => {
    expect(scheduleSchema.safeParse({ type: 'monthly', time: '08:00' }).success).toBe(false);
    expect(
      scheduleSchema.safeParse({ type: 'monthly', time: '08:00', dayOfMonth: 15 }).success,
    ).toBe(true);
  });

  it('rejects malformed HH:mm', () => {
    expect(scheduleSchema.safeParse({ type: 'daily', time: '25:00' }).success).toBe(false);
    expect(scheduleSchema.safeParse({ type: 'daily', time: '08:7' }).success).toBe(false);
  });
});
