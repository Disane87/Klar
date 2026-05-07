# Cashflow (Monat) 1:1 Implementation Plan

> Subagent-driven. Continuous execution.

**Goal:** Add bundle PageMonth's "Soll vs. Ist" budget meter card + filtered Buchungen card to `/app/monat`. Requires a new aggregation endpoint.

---

## Tasks

### Task 1: Shared budget-vs-actuals calc + API endpoint

**File: New `packages/shared/src/budgets/budgets-vs-actuals.ts`**

```ts
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
  /** istCents / sollCents in [0, 1.2] clamped — meter fill ratio. */
  pct: number;
  state: 'ok' | 'warn' | 'over';
}

export function budgetsVsActuals(input: BudgetVsActualInput): BudgetVsActualRow[] {
  const actualsByCat = new Map<string, number>();
  for (const a of input.actuals) {
    actualsByCat.set(a.categoryId, (actualsByCat.get(a.categoryId) ?? 0) + a.istCents);
  }
  return input.budgets.map(b => {
    const ist = actualsByCat.get(b.categoryId) ?? 0;
    const soll = b.sollCents;
    const delta = soll - ist;
    // For expenses (soll < 0), pct = |ist|/|soll|. Clamp to 1.2 (over).
    const denom = Math.abs(soll);
    const pct = denom === 0 ? 0 : Math.min(1.2, Math.abs(ist) / denom);
    let state: BudgetVsActualRow['state'] = 'ok';
    if (pct > 1) state = 'over';
    else if (pct > 0.9) state = 'warn';
    return { categoryId: b.categoryId, sollCents: soll, istCents: ist, deltaCents: delta, pct, state };
  });
}
```

Add a unit spec `packages/shared/src/budgets/budgets-vs-actuals.spec.ts` with 3 tests: under-budget (ok), near-budget (warn 95%), over-budget (over 110%).

**File: API endpoint `apps/api/src/overview/overview.controller.ts`**

Add a new `@Get('budgets-vs-actuals')` route that:
1. Loads `Budget` rows for the household + month (existing BudgetsRepository).
2. Loads transactions for the household + month, sums per categoryId.
3. Loads active RecurringTransactions, computes monthlyEquivalent per category, sums.
4. Combines actuals = sum(transactions per cat) + sum(recurring monthly per cat).
5. Calls `budgetsVsActuals({ budgets, actuals })` from `@klar/shared`.
6. Returns `{ month, rows: BudgetVsActualRow[] }`.

Behind `JwtAuthGuard + HouseholdMemberGuard`. RLS via existing middleware.

E2E test in `apps/api/src/overview/overview.e2e.spec.ts` if one exists, otherwise add a service-level spec.

**Commit:** `feat(overview): budgets-vs-actuals endpoint + shared calc`

---

### Task 2: FE BudgetVsActualsStore + Cashflow page section

**File: New `apps/web/src/app/core/overview/budgets-vs-actuals.store.ts`**

```ts
@Injectable({ providedIn: 'root' })
export class BudgetVsActualsStore {
  private http = inject(HttpClient);
  private hh   = inject(HouseholdStore);

  private readonly month = signal<string>(currentYearMonth());
  setMonth(m: string): void { this.month.set(m); }

  private resource = resource<BudgetVsActualRow[] | undefined, { hid: string | null; month: string }>({
    params: () => ({ hid: this.hh.activeId(), month: this.month() }),
    loader: ({ params }) => {
      if (!params.hid) return Promise.resolve(undefined);
      return firstValueFrom(this.http.get<{ month: string; rows: BudgetVsActualRow[] }>(
        `/api/v1/households/${params.hid}/overview/budgets-vs-actuals`,
        { params: { month: params.month } },
      )).then(r => r.rows);
    },
  });

  readonly rows = computed<BudgetVsActualRow[]>(() => this.resource.value() ?? []);
  readonly loading = this.resource.isLoading;
  readonly error = this.resource.error;
  reload(): void { this.resource.reload(); }
}
```

**File: `apps/web/src/app/pages/monat/monat.component.ts` + `.html`**

Inject the new store, sync its `month` signal with `OverviewStore.currentMonth` via an `effect()`. In the template, add ABOVE the existing breakdown:

```html
<section class="flex flex-col gap-(--s-3)">
  <div class="section-head">
    <span>Soll vs. Ist</span>
    <span class="mono text-(--fg-2)">{{ budgetStore.rows().length }} Kategorien</span>
  </div>
  <div class="card">
    @for (row of budgetStore.rows(); track row.categoryId) {
      <div class="row" [style.border-left-color]="categoryColor(row.categoryId)">
        <div class="lhs flex-1">
          <span class="name">{{ categoryName(row.categoryId) }}</span>
          <div class="flex items-center gap-(--s-3) mt-1">
            <div class="relative h-1 rounded-full overflow-hidden bg-(--line-soft) flex-1">
              <span class="absolute inset-y-0 left-0 rounded-full"
                    [style.width.%]="Math.min(100, row.pct * 100)"
                    [style.background]="categoryColor(row.categoryId)"></span>
            </div>
            <span class="text-[11px] mono shrink-0"
                  [style.color]="row.state === 'over' ? 'var(--danger)' : (row.state === 'warn' ? 'var(--warn)' : 'var(--fg-2)')">
              {{ (row.deltaCents >= 0 ? '+ ' : '− ') }}{{ (row.deltaCents | klarMoney)?.replace('-', '').replace('+', '') }}
            </span>
          </div>
        </div>
        <span class="amt mono text-(--fg-2)">
          <span class="text-(--fg)">{{ row.istCents | klarMoney }}</span> / {{ row.sollCents | klarMoney }}
        </span>
      </div>
    }
    @if (budgetStore.rows().length === 0) {
      <div class="row"><span class="text-(--fg-2) text-[12px]">Keine Budgets gesetzt.</span></div>
    }
  </div>
</section>
```

Add helpers `categoryColor(id)` / `categoryName(id)` via `CategoriesStore.byId()`.

**Commit:** `feat(monat): Soll vs Ist budget meter card`

---

### Task 3: README + verification

```
| **📈 Soll vs. Ist (Monat)** | Cashflow page shows per-category budget vs actuals with progress bar tinted in cat color, mono soll/ist, signed delta and threshold-based tone (ok / warn / over) |
```

Triple-build green.

Commit: `docs(readme): document Cashflow Soll-vs-Ist`
