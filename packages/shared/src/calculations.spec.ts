import { describe, it, expect } from 'vitest';
import {
  safeDayOfMonth,
  toMonthlyEquivalent,
  sumByCents,
  currentYearMonth,
  averageIncome,
  toHttpParams,
  calculateMonthlyOverview,
} from './calculations.js';
import type { OverviewInput, RecurringEntry, TransactionEntry } from './calculations.js';

describe('safeDayOfMonth', () => {
  it('returns day unchanged when valid for the month', () => {
    expect(safeDayOfMonth(2024, 3, 15)).toBe(15);
  });

  it('clamps day 31 to 30 for April', () => {
    expect(safeDayOfMonth(2024, 4, 31)).toBe(30);
  });

  it('clamps day 31 to 29 for February in a leap year (2024)', () => {
    expect(safeDayOfMonth(2024, 2, 31)).toBe(29);
  });

  it('clamps day 31 to 28 for February in a non-leap year (2023)', () => {
    expect(safeDayOfMonth(2023, 2, 31)).toBe(28);
  });

  it('returns 1 for day 1 in any month', () => {
    expect(safeDayOfMonth(2024, 1, 1)).toBe(1);
  });
});

describe('toMonthlyEquivalent', () => {
  it('MONTHLY: returns amount unchanged', () => {
    expect(toMonthlyEquivalent(10000, 'MONTHLY')).toBe(10000);
  });

  it('QUARTERLY: divides by 3 and rounds', () => {
    expect(toMonthlyEquivalent(30000, 'QUARTERLY')).toBe(10000);
  });

  it('QUARTERLY: rounds to nearest cent', () => {
    expect(toMonthlyEquivalent(10000, 'QUARTERLY')).toBe(3333);
  });

  it('YEARLY: divides by 12 and rounds', () => {
    expect(toMonthlyEquivalent(120000, 'YEARLY')).toBe(10000);
  });

  it('YEARLY: rounds to nearest cent', () => {
    expect(toMonthlyEquivalent(10000, 'YEARLY')).toBe(833);
  });

  it('WEEKLY: multiplies by 52/12 and rounds', () => {
    // 1000 cents/week × 52 / 12 = 4333.33… → 4333
    expect(toMonthlyEquivalent(1000, 'WEEKLY')).toBe(4333);
  });

  it('HALF_YEARLY: divides by 6 and rounds', () => {
    expect(toMonthlyEquivalent(60000, 'HALF_YEARLY')).toBe(10000);
  });

  it('HALF_YEARLY: rounds to nearest cent', () => {
    // 10000 / 6 = 1666.66… → 1667
    expect(toMonthlyEquivalent(10000, 'HALF_YEARLY')).toBe(1667);
  });

  it('CUSTOM_DAYS: returns amount unchanged (used as-is)', () => {
    expect(toMonthlyEquivalent(5000, 'CUSTOM_DAYS')).toBe(5000);
  });
});

describe('sumByCents', () => {
  it('sums positive amounts', () => {
    expect(sumByCents([{ amountCents: 100 }, { amountCents: 200 }])).toBe(300);
  });

  it('handles mixed positive and negative (signed amounts)', () => {
    expect(sumByCents([{ amountCents: 1000 }, { amountCents: -500 }, { amountCents: 200 }])).toBe(700);
  });

  it('returns 0 for empty array', () => {
    expect(sumByCents([])).toBe(0);
  });
});

describe('currentYearMonth', () => {
  it('returns string matching YYYY-MM format', () => {
    expect(currentYearMonth()).toMatch(/^\d{4}-\d{2}$/);
  });

  it('returns the current year', () => {
    const year = new Date().getFullYear().toString();
    expect(currentYearMonth()).toMatch(new RegExp(`^${year}-`));
  });
});

// ─── averageIncome ────────────────────────────────────────────────────────────

describe('averageIncome', () => {
  it('returns 0 for empty array', () => {
    expect(averageIncome([])).toBe(0);
  });

  it('returns the single value for a one-element array', () => {
    expect(averageIncome([{ amountCents: 345870 }])).toBe(345870);
  });

  it('returns the arithmetic mean of multiple entries', () => {
    // (10000 + 20000 + 30000) / 3 = 20000
    expect(averageIncome([
      { amountCents: 10000 },
      { amountCents: 20000 },
      { amountCents: 30000 },
    ])).toBe(20000);
  });

  it('rounds to nearest integer', () => {
    // (10000 + 10001) / 2 = 10000.5 → rounds to 10001
    expect(averageIncome([
      { amountCents: 10000 },
      { amountCents: 10001 },
    ])).toBe(10001);
  });

  it('handles negative amounts', () => {
    // (-10000 + -20000) / 2 = -15000
    expect(averageIncome([
      { amountCents: -10000 },
      { amountCents: -20000 },
    ])).toBe(-15000);
  });
});

// ─── toHttpParams ─────────────────────────────────────────────────────────────

describe('toHttpParams', () => {
  it('skips null values', () => {
    const result = toHttpParams({ a: null, b: 'hello' });
    expect(result).not.toHaveProperty('a');
    expect(result['b']).toBe('hello');
  });

  it('skips undefined values', () => {
    const result = toHttpParams({ a: undefined, b: 42 });
    expect(result).not.toHaveProperty('a');
    expect(result['b']).toBe('42');
  });

  it('skips empty string values', () => {
    const result = toHttpParams({ a: '', b: 'world' });
    expect(result).not.toHaveProperty('a');
    expect(result['b']).toBe('world');
  });

  it('converts true to "true"', () => {
    expect(toHttpParams({ flag: true })['flag']).toBe('true');
  });

  it('converts false to "false"', () => {
    expect(toHttpParams({ flag: false })['flag']).toBe('false');
  });

  it('converts numbers to strings', () => {
    expect(toHttpParams({ count: 42 })['count']).toBe('42');
  });

  it('returns an empty object for an all-skipped input', () => {
    expect(toHttpParams({ a: null, b: undefined, c: '' })).toEqual({});
  });

  it('passes through string values unchanged', () => {
    expect(toHttpParams({ month: '2026-04' })['month']).toBe('2026-04');
  });
});

// ─── calculateMonthlyOverview ─────────────────────────────────────────────────

/**
 * Reference fixture (April 2026):
 *   Recurring income  : Festgehalt 3 458,70 € → amountCents 345870, MONTHLY
 *   Recurring expense : Haushaltsgeld 600 € → amountCents -60000, MONTHLY
 *   Recurring expense : Strom 298,97 € → amountCents -29897, MONTHLY
 *   Transaction income: Provision 1 081,11 € → amountCents 108111
 *
 *   Expected surplus:
 *     totalIncome  = 345870 + 108111 = 453981
 *     totalExpenses= 60000  + 29897  = 89897
 *     surplus      = 453981 - 89897  = 364084
 *
 * Note: The CLAUDE.md fixture mentions surplus of ~176510 cents (1 765,10 €)
 * which reflects the full expense set not listed here. The tests below use
 * exact arithmetic on the subset given.
 */
const USER_A = 'user-a';
const USER_B = 'user-b';

const baseRecurringEntries: RecurringEntry[] = [
  // Festgehalt — positive income, SHARED
  { amountCents: 345870, frequency: 'MONTHLY', isVariable: false, visibility: 'SHARED', createdByUserId: USER_A },
  // Haushaltsgeld — expense, SHARED
  { amountCents: -60000, frequency: 'MONTHLY', isVariable: false, visibility: 'SHARED', createdByUserId: USER_A },
  // Strom — expense, SHARED
  { amountCents: -29897, frequency: 'MONTHLY', isVariable: false, visibility: 'SHARED', createdByUserId: USER_A },
];

const baseTransactionEntries: TransactionEntry[] = [
  // Provision — variable income, SHARED
  { amountCents: 108111, visibility: 'SHARED', createdByUserId: USER_A },
];

describe('calculateMonthlyOverview', () => {
  it('computes correct totals for the April 2026 reference fixture', () => {
    const result = calculateMonthlyOverview({
      recurringEntries: baseRecurringEntries,
      transactionEntries: baseTransactionEntries,
      requestingUserId: USER_A,
    });

    expect(result.recurringIncomeCents).toBe(345870);
    expect(result.recurringExpensesCents).toBe(89897); // 60000 + 29897
    expect(result.transactionIncomeCents).toBe(108111);
    expect(result.transactionExpensesCents).toBe(0);
    expect(result.totalIncomeCents).toBe(453981);   // 345870 + 108111
    expect(result.totalExpensesCents).toBe(89897);
    expect(result.surplusCents).toBe(364084);        // 453981 - 89897
  });

  it('surplus equals totalIncome - totalExpenses', () => {
    const result = calculateMonthlyOverview({
      recurringEntries: baseRecurringEntries,
      transactionEntries: baseTransactionEntries,
      requestingUserId: USER_A,
    });
    expect(result.surplusCents).toBe(result.totalIncomeCents - result.totalExpensesCents);
  });

  it('applies toMonthlyEquivalent to QUARTERLY recurring entries', () => {
    const quarterlyEntries: RecurringEntry[] = [
      { amountCents: -18000, frequency: 'QUARTERLY', isVariable: false, visibility: 'SHARED', createdByUserId: USER_A },
    ];
    const result = calculateMonthlyOverview({
      recurringEntries: quarterlyEntries,
      transactionEntries: [],
      requestingUserId: USER_A,
    });
    // -18000 / 3 = -6000 → 6000 expenses
    expect(result.recurringExpensesCents).toBe(6000);
  });

  it('applies toMonthlyEquivalent to YEARLY recurring entries', () => {
    const yearlyEntries: RecurringEntry[] = [
      { amountCents: -120000, frequency: 'YEARLY', isVariable: false, visibility: 'SHARED', createdByUserId: USER_A },
    ];
    const result = calculateMonthlyOverview({
      recurringEntries: yearlyEntries,
      transactionEntries: [],
      requestingUserId: USER_A,
    });
    // -120000 / 12 = -10000 → 10000 expenses
    expect(result.recurringExpensesCents).toBe(10000);
  });

  it('excludes PRIVATE entries from other users', () => {
    const privateEntry: RecurringEntry = {
      amountCents: -50000,
      frequency: 'MONTHLY',
      isVariable: false,
      visibility: 'PRIVATE',
      createdByUserId: USER_B, // belongs to B, not the requesting user
    };
    const result = calculateMonthlyOverview({
      recurringEntries: [privateEntry],
      transactionEntries: [],
      requestingUserId: USER_A, // A is requesting
    });
    // User B's private entry must be invisible
    expect(result.recurringExpensesCents).toBe(0);
    expect(result.totalExpensesCents).toBe(0);
  });

  it("includes the requesting user's own PRIVATE entries", () => {
    const ownPrivateEntry: RecurringEntry = {
      amountCents: -50000,
      frequency: 'MONTHLY',
      isVariable: false,
      visibility: 'PRIVATE',
      createdByUserId: USER_A, // belongs to the requesting user
    };
    const result = calculateMonthlyOverview({
      recurringEntries: [ownPrivateEntry],
      transactionEntries: [],
      requestingUserId: USER_A,
    });
    expect(result.recurringExpensesCents).toBe(50000);
  });

  it('excludes PRIVATE transactions from other users', () => {
    const privateTx: TransactionEntry = {
      amountCents: 100000,
      visibility: 'PRIVATE',
      createdByUserId: USER_B,
    };
    const result = calculateMonthlyOverview({
      recurringEntries: [],
      transactionEntries: [privateTx],
      requestingUserId: USER_A,
    });
    expect(result.transactionIncomeCents).toBe(0);
  });

  it('returns all zeros for empty input', () => {
    const result = calculateMonthlyOverview({
      recurringEntries: [],
      transactionEntries: [],
      requestingUserId: USER_A,
    });
    expect(result).toEqual({
      recurringIncomeCents: 0,
      recurringExpensesCents: 0,
      transactionIncomeCents: 0,
      transactionExpensesCents: 0,
      totalIncomeCents: 0,
      totalExpensesCents: 0,
      surplusCents: 0,
    });
  });

  it('can produce a negative surplus (deficit)', () => {
    const result = calculateMonthlyOverview({
      recurringEntries: [
        { amountCents: -200000, frequency: 'MONTHLY', isVariable: false, visibility: 'SHARED', createdByUserId: USER_A },
      ],
      transactionEntries: [
        { amountCents: 100000, visibility: 'SHARED', createdByUserId: USER_A },
      ],
      requestingUserId: USER_A,
    });
    expect(result.surplusCents).toBe(-100000);
  });
});
