import { describe, it, expect } from 'vitest';
import { safeDayOfMonth, toMonthlyEquivalent, sumByCents, currentYearMonth } from './calculations.js';

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
