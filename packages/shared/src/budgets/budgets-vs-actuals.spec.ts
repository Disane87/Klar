import { describe, it, expect } from 'vitest';
import { budgetsVsActuals } from './budgets-vs-actuals';

describe('budgetsVsActuals', () => {
  it('marks under-budget categories as ok', () => {
    const rows = budgetsVsActuals({
      budgets: [{ categoryId: 'food', sollCents: -50000 }],
      actuals: [{ categoryId: 'food', istCents: -20000 }],
    });

    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row.sollCents).toBe(-50000);
    expect(row.istCents).toBe(-20000);
    expect(row.deltaCents).toBe(-30000);
    expect(row.pct).toBeCloseTo(0.4, 5);
    expect(row.state).toBe('ok');
  });

  it('marks near-budget categories (>90%) as warn', () => {
    const rows = budgetsVsActuals({
      budgets: [{ categoryId: 'rent', sollCents: -100000 }],
      actuals: [{ categoryId: 'rent', istCents: -95000 }],
    });

    expect(rows[0].pct).toBeCloseTo(0.95, 5);
    expect(rows[0].state).toBe('warn');
    expect(rows[0].deltaCents).toBe(-5000);
  });

  it('marks over-budget categories (>100%) as over and clamps pct to 1.2', () => {
    const rows = budgetsVsActuals({
      budgets: [{ categoryId: 'fun', sollCents: -10000 }],
      actuals: [
        { categoryId: 'fun', istCents: -8000 },
        { categoryId: 'fun', istCents: -10000 }, // total = -18000 → 180% → clamped 1.2
      ],
    });

    expect(rows[0].istCents).toBe(-18000);
    expect(rows[0].pct).toBe(1.2);
    expect(rows[0].state).toBe('over');
    expect(rows[0].deltaCents).toBe(8000); // soll(-10000) - ist(-18000) = 8000
  });

  it('returns 0 ist and pct=0 when no actuals match the category', () => {
    const rows = budgetsVsActuals({
      budgets: [{ categoryId: 'savings', sollCents: -20000 }],
      actuals: [],
    });

    expect(rows[0].istCents).toBe(0);
    expect(rows[0].pct).toBe(0);
    expect(rows[0].state).toBe('ok');
    expect(rows[0].deltaCents).toBe(-20000);
  });

  it('handles soll=0 without dividing by zero', () => {
    const rows = budgetsVsActuals({
      budgets: [{ categoryId: 'x', sollCents: 0 }],
      actuals: [{ categoryId: 'x', istCents: -5000 }],
    });

    expect(rows[0].pct).toBe(0);
    expect(rows[0].state).toBe('ok');
    expect(rows[0].deltaCents).toBe(5000);
  });
});
