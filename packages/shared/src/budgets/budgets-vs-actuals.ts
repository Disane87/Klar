// Budgets vs. Actuals — pure aggregation.
//
// Input: per-category target (Soll, signed cents) + per-category realized total
// (Ist, signed cents — sum of transactions in the month plus active recurring
// transactions expanded to their monthly equivalent).
//
// Output: one row per budget with delta (Soll − Ist), pct (|Ist|/|Soll| clamped
// to [0, 1.2]) and a threshold-based state ('ok' | 'warn' | 'over').

export interface BudgetVsActualInput {
  /** Per-category target budget for the month, signed cents (negative = expense). */
  budgets: ReadonlyArray<{ categoryId: string; sollCents: number }>;
  /**
   * Actuals for the month: every realized transaction summed per category
   * PLUS every active recurring expanded to its monthly equivalent.
   * Signed (negative = expense).
   */
  actuals: ReadonlyArray<{ categoryId: string; istCents: number }>;
}

export interface BudgetVsActualRow {
  categoryId: string;
  sollCents: number;
  istCents: number;
  /** sollCents - istCents — positive = under budget, negative = over budget. */
  deltaCents: number;
  /** |ist| / |soll| in [0, 1.2] clamped — meter fill ratio. */
  pct: number;
  state: 'ok' | 'warn' | 'over';
}

export function budgetsVsActuals(input: BudgetVsActualInput): BudgetVsActualRow[] {
  const actualsByCat = new Map<string, number>();
  for (const a of input.actuals) {
    actualsByCat.set(a.categoryId, (actualsByCat.get(a.categoryId) ?? 0) + a.istCents);
  }
  return input.budgets.map((b) => {
    const ist = actualsByCat.get(b.categoryId) ?? 0;
    const soll = b.sollCents;
    const delta = soll - ist;
    const denom = Math.abs(soll);
    const pct = denom === 0 ? 0 : Math.min(1.2, Math.abs(ist) / denom);
    let state: BudgetVsActualRow['state'] = 'ok';
    if (pct > 1) state = 'over';
    else if (pct > 0.9) state = 'warn';
    return {
      categoryId: b.categoryId,
      sollCents: soll,
      istCents: ist,
      deltaCents: delta,
      pct,
      state,
    };
  });
}
