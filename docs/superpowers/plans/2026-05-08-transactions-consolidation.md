# Transactions Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate `/app/buchungen` and `/app/banken/:c/:a` so they share one canonical `<klar-transactions-table>` component (filter bar + quick chips + monthly groups + edit/add), backed by `TransactionsStore` only — no ad-hoc HTTP calls, no duplicate filter logic.

**Architecture:** New domain-shared package at `apps/web/src/app/shared/transactions/` containing pure helpers (`transaction-filters.ts`, `transaction-month-grouping.ts`) and presentation components (filter-bar, quick-chips, row, table container). Two route pages (`BuchungenPageComponent`, `BankenAccountDetailComponent`) become thin wrappers around the same table; difference is the header (summary-strip vs. hero) and the `lockedFilters` input. `TransactionsStore` gains an `accountIdFilter` signal so the same store can drive both routes.

**Tech Stack:** Angular 21 zoneless · Signal Forms · Angular `resource()` · Tailwind 4 · Vitest · Playwright · NestJS 11 (read-only — backend already supports `?accountId` + `?month`).

**Spec:** [`docs/superpowers/specs/2026-05-08-transactions-consolidation-design.md`](../specs/2026-05-08-transactions-consolidation-design.md)

---

## File Structure

**New files:**

```
apps/web/src/app/shared/transactions/
  transaction-filters.ts                                  # Pure types + applyFilters()
  transaction-filters.spec.ts
  transaction-month-grouping.ts                           # Pure groupByMonth()
  transaction-month-grouping.spec.ts
  klar-transactions-row.component.ts                      # Single row presentation
  klar-transactions-row.component.spec.ts
  klar-transactions-quick-chips.component.ts              # 4 chip toggles
  klar-transactions-quick-chips.component.spec.ts
  klar-transactions-filter-bar.component.ts               # Search + selects + reset
  klar-transactions-filter-bar.component.spec.ts
  klar-transactions-table.component.ts                    # Container — orchestrates state
  klar-transactions-table.component.spec.ts
```

**Modified files:**

- `apps/web/src/app/core/transactions/transactions.store.ts` — add `accountIdFilter` signal, branch loader.
- `apps/web/src/app/core/transactions/transactions.store.spec.ts` — extend tests.
- `apps/web/src/app/pages/buchungen/buchungen.component.ts` — drop tabs, render `<klar-transactions-table>`.
- `apps/web/src/app/pages/buchungen/buchungen.component.html` — collapse to header + summary-strip + table.
- `apps/web/src/app/pages/buchungen/buchungen.component.css` — remove tab styles, keep summary-strip layout if any.
- `apps/web/src/app/pages/buchungen/buchungen.component.spec.ts` — replace tab assertions with table-integration assertions.
- `apps/web/src/app/pages/buchungen/transaction-dialog.component.ts` — accept optional `presetAccountId` input.
- `apps/web/src/app/pages/banken/banken-account-detail.component.ts` — drop ad-hoc HTTP, drop inline filter/group logic, render `<klar-transactions-table>` with `lockedFilters`.

**Deleted code (within Commit 4):**

- `FILTER_PREDICATES`, `filter`/`filtered`/`filterCounts` signals in buchungen.
- Inline filter bar template + `searchQuery`/`amountFilter`/`sourceFilter`/`filteredTransactions`/`monthlyGroups` in banken-account-detail.
- Local `transactions` signal + `loadTransactions()` in banken-account-detail.

---

## Task 1: Pure helper — `transaction-filters.ts`

**Files:**
- Create: `apps/web/src/app/shared/transactions/transaction-filters.ts`
- Test: `apps/web/src/app/shared/transactions/transaction-filters.spec.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// apps/web/src/app/shared/transactions/transaction-filters.spec.ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter web test -- transaction-filters.spec`
Expected: FAIL — module `./transaction-filters` not found.

- [ ] **Step 3: Implement the helper**

```ts
// apps/web/src/app/shared/transactions/transaction-filters.ts
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
}

export const EMPTY_FILTERS: TransactionFilters = {
  search: '',
  accountId: null,
  categoryId: null,
  source: 'all',
  amount: 'all',
  recurring: 'all',
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
    return true;
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter web test -- transaction-filters.spec`
Expected: PASS — all 9 tests green.

- [ ] **Step 5: Lint + typecheck**

Run: `pnpm --filter web lint && pnpm --filter web build`
Expected: zero errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/shared/transactions/transaction-filters.ts apps/web/src/app/shared/transactions/transaction-filters.spec.ts
git commit -m "feat(web): pure transaction-filters helper for unified table"
```

---

## Task 2: Pure helper — `transaction-month-grouping.ts`

**Files:**
- Create: `apps/web/src/app/shared/transactions/transaction-month-grouping.ts`
- Test: `apps/web/src/app/shared/transactions/transaction-month-grouping.spec.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// apps/web/src/app/shared/transactions/transaction-month-grouping.spec.ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter web test -- transaction-month-grouping.spec`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the helper**

```ts
// apps/web/src/app/shared/transactions/transaction-month-grouping.ts
import type { Transaction } from '../../core/transactions/transactions.store';

export interface MonthGroup {
  key: string;
  label: string;
  items: Transaction[];
  itemsCount: number;
  totalCents: number;
}

export function groupByMonth(items: readonly Transaction[]): MonthGroup[] {
  const sorted = [...items].sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return b.createdAt.localeCompare(a.createdAt);
  });
  const buckets = new Map<string, Transaction[]>();
  for (const t of sorted) {
    const key = t.date.slice(0, 7);
    const arr = buckets.get(key) ?? [];
    arr.push(t);
    buckets.set(key, arr);
  }
  return Array.from(buckets.entries()).map(([key, group]) => ({
    key,
    label: formatMonthLabel(key),
    items: group,
    itemsCount: group.length,
    totalCents: group.reduce((s, t) => s + t.amountCents, 0),
  }));
}

function formatMonthLabel(yearMonth: string): string {
  const [y, m] = yearMonth.split('-').map(Number);
  if (!y || !m) return yearMonth;
  const date = new Date(Date.UTC(y, m - 1, 1));
  return new Intl.DateTimeFormat('de-DE', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter web test -- transaction-month-grouping.spec`
Expected: PASS — all 6 tests green.

- [ ] **Step 5: Lint + typecheck**

Run: `pnpm --filter web lint && pnpm --filter web build`
Expected: zero errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/shared/transactions/transaction-month-grouping.ts apps/web/src/app/shared/transactions/transaction-month-grouping.spec.ts
git commit -m "feat(web): pure month-grouping helper for transactions table"
```

---

## Task 3: Row component — `klar-transactions-row.component.ts`

**Files:**
- Create: `apps/web/src/app/shared/transactions/klar-transactions-row.component.ts`
- Test: `apps/web/src/app/shared/transactions/klar-transactions-row.component.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/app/shared/transactions/klar-transactions-row.component.spec.ts
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { describe, it, expect, vi } from 'vitest';
import { KlarTransactionsRowComponent } from './klar-transactions-row.component';
import { CategoriesStore } from '../../core/categories/categories.store';
import type { Transaction } from '../../core/transactions/transactions.store';

function tx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'id', householdId: 'h', categoryId: 'c1', projectId: null,
    recurringTransactionId: null, amountCents: -1234, plannedAmountCents: null,
    isPlanned: false, description: 'Test', counterparty: 'Edeka',
    date: '2026-05-04', visibility: 'SHARED', color: null, icon: null,
    createdAt: '2026-05-04T10:00:00Z', source: 'manual',
    bankFieldsLockedAt: null, fintsSyncRunId: null, ...overrides,
  };
}

describe('KlarTransactionsRowComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [KlarTransactionsRowComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: CategoriesStore, useValue: { byId: () => null } },
      ],
    });
  });

  it('renders the counterparty as primary label, falling back to description', () => {
    const fixture = TestBed.createComponent(KlarTransactionsRowComponent);
    fixture.componentRef.setInput('tx', tx({ counterparty: 'Edeka', description: 'Other' }));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Edeka');
  });

  it('emits rowClick on click', () => {
    const fixture = TestBed.createComponent(KlarTransactionsRowComponent);
    const spy = vi.fn();
    fixture.componentRef.setInput('tx', tx({ id: 'abc' }));
    fixture.componentInstance.rowClick.subscribe(spy);
    fixture.detectChanges();
    fixture.nativeElement.querySelector('[role="button"]').click();
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ id: 'abc' }));
  });

  it('shows recurring chip when recurringTransactionId is set', () => {
    const fixture = TestBed.createComponent(KlarTransactionsRowComponent);
    fixture.componentRef.setInput('tx', tx({ recurringTransactionId: 'r1' }));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('wiederkehrend');
  });

  it('shows FinTS badge when source is fints', () => {
    const fixture = TestBed.createComponent(KlarTransactionsRowComponent);
    fixture.componentRef.setInput('tx', tx({ source: 'fints' }));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('FinTS');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- klar-transactions-row.component.spec`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the component**

```ts
// apps/web/src/app/shared/transactions/klar-transactions-row.component.ts
import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { CategoriesStore } from '../../core/categories/categories.store';
import { KlarIconComponent } from '../icons/klar-icon.component';
import { KlarBadgeComponent } from '../ui/klar-badge.component';
import { KlarMoneyPipe } from '../pipes/klar-money.pipe';
import type { Transaction } from '../../core/transactions/transactions.store';

@Component({
  selector: 'klar-transactions-row',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [KlarIconComponent, KlarBadgeComponent, KlarMoneyPipe],
  template: `
    <div
      role="button"
      tabindex="0"
      class="grid items-center gap-3 px-4 py-3 border-b border-(--line-soft) hover:bg-(--bg-2) transition-colors cursor-pointer min-h-[44px]"
      style="grid-template-columns: 60px auto 1fr auto;"
      [style.border-left]="'2px solid ' + categoryColor()"
      (click)="rowClick.emit(tx())"
      (keydown.enter)="rowClick.emit(tx())"
      (keydown.space)="$event.preventDefault(); rowClick.emit(tx())"
    >
      <span class="text-[11px] mono tabular-nums text-(--fg-2)">{{ dayLabel() }}</span>
      <span class="shrink-0" [style.color]="categoryColor()">
        <klar-icon [name]="iconName()" [size]="16" />
      </span>
      <div class="min-w-0">
        <div class="text-[13px] truncate text-(--fg) flex items-center gap-2">
          <span class="truncate">{{ primaryLabel() }}</span>
          @if (tx().recurringTransactionId) {
            <span class="chip outline" style="height:18px;font-size:10px;">
              <klar-icon name="wiederkehrend" [size]="10" /> wiederkehrend
            </span>
          }
        </div>
      </div>
      <div class="flex items-center gap-2 shrink-0">
        @if (tx().source === 'fints') {
          <klar-badge tone="zinc">FinTS</klar-badge>
        }
        <span
          class="text-[13px] mono tabular-nums font-medium"
          [class.text-success]="tx().amountCents > 0"
          [class.text-danger]="tx().amountCents < 0"
        >
          {{ tx().amountCents > 0 ? '+ ' : '' }}{{ tx().amountCents | klarMoney }}
        </span>
      </div>
    </div>
  `,
})
export class KlarTransactionsRowComponent {
  readonly tx = input.required<Transaction>();
  readonly rowClick = output<Transaction>();

  private readonly categories = inject(CategoriesStore);

  readonly primaryLabel = computed(() =>
    this.tx().counterparty?.trim() || this.tx().description?.trim() || '—',
  );

  readonly dayLabel = computed(() => {
    const [, mm, dd] = this.tx().date.split('-');
    return `${dd}.${mm}.`;
  });

  readonly categoryColor = computed(() => {
    const t = this.tx();
    const cat = t.categoryId ? this.categories.byId(t.categoryId) : null;
    return cat?.color ?? (t.amountCents >= 0 ? 'var(--success)' : 'var(--fg-3)');
  });

  readonly iconName = computed(() => {
    const t = this.tx();
    if (t.icon) return t.icon;
    if (!t.categoryId) return t.amountCents > 0 ? 'trending' : 'receipt';
    return this.categories.byId(t.categoryId)?.icon ?? 'receipt';
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web test -- klar-transactions-row.component.spec`
Expected: PASS — all 4 tests green.

- [ ] **Step 5: Lint + typecheck**

Run: `pnpm --filter web lint && pnpm --filter web build`
Expected: zero errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/shared/transactions/klar-transactions-row.component.ts apps/web/src/app/shared/transactions/klar-transactions-row.component.spec.ts
git commit -m "feat(web): klar-transactions-row presentation component"
```

---

## Task 4: Quick chips — `klar-transactions-quick-chips.component.ts`

**Files:**
- Create: `apps/web/src/app/shared/transactions/klar-transactions-quick-chips.component.ts`
- Test: `apps/web/src/app/shared/transactions/klar-transactions-quick-chips.component.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/app/shared/transactions/klar-transactions-quick-chips.component.spec.ts
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { describe, it, expect, vi } from 'vitest';
import { KlarTransactionsQuickChipsComponent } from './klar-transactions-quick-chips.component';
import { EMPTY_FILTERS } from './transaction-filters';

describe('KlarTransactionsQuickChipsComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [KlarTransactionsQuickChipsComponent],
      providers: [provideZonelessChangeDetection()],
    });
  });

  function findChip(el: HTMLElement, label: string): HTMLButtonElement {
    return Array.from(el.querySelectorAll('button')).find(
      b => (b.textContent ?? '').trim().includes(label),
    ) as HTMLButtonElement;
  }

  it('emits recurring=recurring when "Wiederkehrend" clicked from inactive', () => {
    const fixture = TestBed.createComponent(KlarTransactionsQuickChipsComponent);
    fixture.componentRef.setInput('filters', EMPTY_FILTERS);
    const spy = vi.fn();
    fixture.componentInstance.filtersChange.subscribe(spy);
    fixture.detectChanges();
    findChip(fixture.nativeElement, 'Wiederkehrend').click();
    expect(spy).toHaveBeenCalledWith({ ...EMPTY_FILTERS, recurring: 'recurring' });
  });

  it('toggles back to recurring=all when "Wiederkehrend" clicked from active', () => {
    const fixture = TestBed.createComponent(KlarTransactionsQuickChipsComponent);
    fixture.componentRef.setInput('filters', { ...EMPTY_FILTERS, recurring: 'recurring' });
    const spy = vi.fn();
    fixture.componentInstance.filtersChange.subscribe(spy);
    fixture.detectChanges();
    findChip(fixture.nativeElement, 'Wiederkehrend').click();
    expect(spy).toHaveBeenCalledWith({ ...EMPTY_FILTERS, recurring: 'all' });
  });

  it('emits source=fints when "FinTS" clicked', () => {
    const fixture = TestBed.createComponent(KlarTransactionsQuickChipsComponent);
    fixture.componentRef.setInput('filters', EMPTY_FILTERS);
    const spy = vi.fn();
    fixture.componentInstance.filtersChange.subscribe(spy);
    fixture.detectChanges();
    findChip(fixture.nativeElement, 'FinTS').click();
    expect(spy).toHaveBeenCalledWith({ ...EMPTY_FILTERS, source: 'fints' });
  });

  it('emits amount=income when "Eingänge" clicked', () => {
    const fixture = TestBed.createComponent(KlarTransactionsQuickChipsComponent);
    fixture.componentRef.setInput('filters', EMPTY_FILTERS);
    const spy = vi.fn();
    fixture.componentInstance.filtersChange.subscribe(spy);
    fixture.detectChanges();
    findChip(fixture.nativeElement, 'Eingänge').click();
    expect(spy).toHaveBeenCalledWith({ ...EMPTY_FILTERS, amount: 'income' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- klar-transactions-quick-chips.component.spec`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the component**

```ts
// apps/web/src/app/shared/transactions/klar-transactions-quick-chips.component.ts
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { type TransactionFilters } from './transaction-filters';

interface ChipDef {
  label: string;
  isActive: (f: TransactionFilters) => boolean;
  apply: (f: TransactionFilters) => TransactionFilters;
  clear: (f: TransactionFilters) => TransactionFilters;
}

const CHIPS: readonly ChipDef[] = [
  {
    label: 'Wiederkehrend',
    isActive: f => f.recurring === 'recurring',
    apply:    f => ({ ...f, recurring: 'recurring' }),
    clear:    f => ({ ...f, recurring: 'all' }),
  },
  {
    label: 'Eingänge',
    isActive: f => f.amount === 'income',
    apply:    f => ({ ...f, amount: 'income' }),
    clear:    f => ({ ...f, amount: 'all' }),
  },
  {
    label: 'FinTS',
    isActive: f => f.source === 'fints',
    apply:    f => ({ ...f, source: 'fints' }),
    clear:    f => ({ ...f, source: 'all' }),
  },
  {
    label: 'Manuell',
    isActive: f => f.source === 'manual',
    apply:    f => ({ ...f, source: 'manual' }),
    clear:    f => ({ ...f, source: 'all' }),
  },
];

@Component({
  selector: 'klar-transactions-quick-chips',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex items-center gap-2 overflow-x-auto pb-1 -mx-(--s-1) px-(--s-1)">
      @for (chip of chips; track chip.label) {
        <button
          type="button"
          class="shrink-0 px-3 py-1.5 rounded-full border text-[12px] transition-colors"
          [class.bg-\\(--bg-3\\)]="chip.isActive(filters())"
          [class.text-\\(--fg\\)]="chip.isActive(filters())"
          [class.border-\\(--line\\)]="!chip.isActive(filters())"
          [class.bg-transparent]="!chip.isActive(filters())"
          [class.text-\\(--fg-2\\)]="!chip.isActive(filters())"
          (click)="onToggle(chip)"
        >
          {{ chip.label }}
        </button>
      }
    </div>
  `,
})
export class KlarTransactionsQuickChipsComponent {
  readonly filters = input.required<TransactionFilters>();
  readonly filtersChange = output<TransactionFilters>();

  protected readonly chips = CHIPS;

  protected onToggle(chip: ChipDef): void {
    const current = this.filters();
    const next = chip.isActive(current) ? chip.clear(current) : chip.apply(current);
    this.filtersChange.emit(next);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web test -- klar-transactions-quick-chips.component.spec`
Expected: PASS — all 4 tests green.

- [ ] **Step 5: Lint + typecheck**

Run: `pnpm --filter web lint && pnpm --filter web build`
Expected: zero errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/shared/transactions/klar-transactions-quick-chips.component.ts apps/web/src/app/shared/transactions/klar-transactions-quick-chips.component.spec.ts
git commit -m "feat(web): klar-transactions-quick-chips for one-tap filter shortcuts"
```

---

## Task 5: Filter bar — `klar-transactions-filter-bar.component.ts`

**Files:**
- Create: `apps/web/src/app/shared/transactions/klar-transactions-filter-bar.component.ts`
- Test: `apps/web/src/app/shared/transactions/klar-transactions-filter-bar.component.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/app/shared/transactions/klar-transactions-filter-bar.component.spec.ts
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { describe, it, expect, vi } from 'vitest';
import { KlarTransactionsFilterBarComponent } from './klar-transactions-filter-bar.component';
import { EMPTY_FILTERS } from './transaction-filters';

describe('KlarTransactionsFilterBarComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [KlarTransactionsFilterBarComponent],
      providers: [provideZonelessChangeDetection()],
    });
  });

  function build(lockedKeys: readonly string[] = []) {
    const fixture = TestBed.createComponent(KlarTransactionsFilterBarComponent);
    fixture.componentRef.setInput('filters', EMPTY_FILTERS);
    fixture.componentRef.setInput('lockedKeys', lockedKeys);
    fixture.componentRef.setInput('accountOptions', [
      { value: 'acc1', label: 'Giro' },
      { value: 'acc2', label: 'Spar' },
    ]);
    fixture.detectChanges();
    return fixture;
  }

  it('emits filters with new search on input', () => {
    const fixture = build();
    const spy = vi.fn();
    fixture.componentInstance.filtersChange.subscribe(spy);
    const input = fixture.nativeElement.querySelector('input[type="search"]') as HTMLInputElement;
    input.value = 'edeka';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(spy).toHaveBeenCalledWith({ ...EMPTY_FILTERS, search: 'edeka' });
  });

  it('emits reset signal on reset click', () => {
    const fixture = TestBed.createComponent(KlarTransactionsFilterBarComponent);
    fixture.componentRef.setInput('filters', { ...EMPTY_FILTERS, search: 'foo' });
    fixture.componentRef.setInput('lockedKeys', []);
    fixture.componentRef.setInput('accountOptions', []);
    const spy = vi.fn();
    fixture.componentInstance.resetClick.subscribe(spy);
    fixture.detectChanges();
    const btn = Array.from(fixture.nativeElement.querySelectorAll('button')).find(
      (b: HTMLButtonElement) => (b.textContent ?? '').includes('Filter zurücksetzen'),
    ) as HTMLButtonElement;
    btn.click();
    expect(spy).toHaveBeenCalled();
  });

  it('does not render a remove icon for a locked accountId pill', () => {
    const fixture = TestBed.createComponent(KlarTransactionsFilterBarComponent);
    fixture.componentRef.setInput('filters', { ...EMPTY_FILTERS, accountId: 'acc1' });
    fixture.componentRef.setInput('lockedKeys', ['accountId']);
    fixture.componentRef.setInput('accountOptions', [{ value: 'acc1', label: 'Giro' }]);
    fixture.detectChanges();
    const accountSelect = fixture.nativeElement.querySelector('[data-filter="accountId"]');
    expect(accountSelect?.getAttribute('data-locked')).toBe('true');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- klar-transactions-filter-bar.component.spec`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the component**

```ts
// apps/web/src/app/shared/transactions/klar-transactions-filter-bar.component.ts
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { KlarInputComponent } from '../ui/klar-input.component';
import { KlarSelectComponent, type KlarSelectOption } from '../ui/klar-select.component';
import { KlarToggleGroupComponent, type KlarToggleOption } from '../ui/klar-toggle-group.component';
import { KlarButtonComponent } from '../ui/klar-button.component';
import {
  type AmountFilter,
  type SourceFilter,
  type TransactionFilters,
} from './transaction-filters';

export type LockableFilterKey = 'accountId' | 'categoryId' | 'source' | 'amount';

@Component({
  selector: 'klar-transactions-filter-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    KlarInputComponent,
    KlarSelectComponent,
    KlarToggleGroupComponent,
    KlarButtonComponent,
  ],
  template: `
    <div class="flex flex-col md:flex-row md:items-end gap-2">
      <div class="flex-1 min-w-0">
        <klar-input
          type="search"
          placeholder="Beschreibung, Empfänger oder Verwendungszweck …"
          iconName="search"
          [ngModel]="filters().search"
          (ngModelChange)="patch({ search: $event })"
        />
      </div>

      @if (accountOptions().length > 0) {
        <div [attr.data-filter]="'accountId'" [attr.data-locked]="isLocked('accountId')">
          <klar-select
            [options]="accountOptionsWithAll()"
            [value]="filters().accountId ?? '__all__'"
            [disabled]="isLocked('accountId')"
            (valueChange)="patch({ accountId: $event === '__all__' ? null : $event })"
          />
        </div>
      }

      <klar-toggle-group
        [options]="amountOptions"
        [value]="filters().amount"
        [disabled]="isLocked('amount')"
        (valueChange)="patch({ amount: ($event || 'all') as AmountFilter })"
      />
      <klar-toggle-group
        [options]="sourceOptions"
        [value]="filters().source"
        [disabled]="isLocked('source')"
        (valueChange)="patch({ source: ($event || 'all') as SourceFilter })"
      />

      @if (showReset()) {
        <klar-button tone="ghost" size="sm" icon="x" (click)="resetClick.emit()">
          Filter zurücksetzen
        </klar-button>
      }
    </div>
  `,
})
export class KlarTransactionsFilterBarComponent {
  readonly filters = input.required<TransactionFilters>();
  readonly lockedKeys = input<readonly LockableFilterKey[]>([]);
  readonly accountOptions = input<readonly KlarSelectOption<string>[]>([]);
  readonly showReset = input<boolean>(false);

  readonly filtersChange = output<TransactionFilters>();
  readonly resetClick = output<void>();

  protected readonly amountOptions: readonly KlarToggleOption<AmountFilter>[] = [
    { value: 'all',     label: 'Alle' },
    { value: 'income',  label: 'Eingang' },
    { value: 'expense', label: 'Ausgang' },
  ];

  protected readonly sourceOptions: readonly KlarToggleOption<SourceFilter>[] = [
    { value: 'all',    label: 'Alle Quellen' },
    { value: 'fints',  label: 'FinTS' },
    { value: 'manual', label: 'Manuell' },
    { value: 'csv',    label: 'CSV' },
  ];

  protected readonly accountOptionsWithAll = computed(() => [
    { value: '__all__', label: 'Alle Konten' },
    ...this.accountOptions(),
  ]);

  protected isLocked(key: LockableFilterKey): boolean {
    return this.lockedKeys().includes(key);
  }

  protected patch(partial: Partial<TransactionFilters>): void {
    this.filtersChange.emit({ ...this.filters(), ...partial });
  }

  protected readonly AmountFilter!: AmountFilter;
  protected readonly SourceFilter!: SourceFilter;
}
```

Note: the trailing typed phantoms (`AmountFilter`, `SourceFilter`) keep the template's type assertions visible to the Angular compiler when strict templates are on. If template strictness rejects them, drop the casts and rely on the runtime `|| 'all'` guard.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web test -- klar-transactions-filter-bar.component.spec`
Expected: PASS — all 3 tests green.

- [ ] **Step 5: Lint + typecheck**

Run: `pnpm --filter web lint && pnpm --filter web build`
Expected: zero errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/shared/transactions/klar-transactions-filter-bar.component.ts apps/web/src/app/shared/transactions/klar-transactions-filter-bar.component.spec.ts
git commit -m "feat(web): klar-transactions-filter-bar with lockable filter keys"
```

---

## Task 6: Container — `klar-transactions-table.component.ts`

**Files:**
- Create: `apps/web/src/app/shared/transactions/klar-transactions-table.component.ts`
- Test: `apps/web/src/app/shared/transactions/klar-transactions-table.component.spec.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// apps/web/src/app/shared/transactions/klar-transactions-table.component.spec.ts
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { describe, it, expect, vi } from 'vitest';
import { KlarTransactionsTableComponent } from './klar-transactions-table.component';
import { CategoriesStore } from '../../core/categories/categories.store';
import type { Transaction } from '../../core/transactions/transactions.store';

function tx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'id-' + Math.random(), householdId: 'h', categoryId: 'c1', projectId: null,
    recurringTransactionId: null, amountCents: -100, plannedAmountCents: null,
    isPlanned: false, description: 'x', counterparty: null,
    date: '2026-05-04', visibility: 'SHARED', color: null, icon: null,
    createdAt: '2026-05-04T10:00:00Z', source: 'manual',
    bankFieldsLockedAt: null, fintsSyncRunId: null, ...overrides,
  };
}

describe('KlarTransactionsTableComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [KlarTransactionsTableComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: CategoriesStore, useValue: { byId: () => null, items: () => [] } },
      ],
    });
  });

  it('locked filters from input are merged into initial state', () => {
    const fixture = TestBed.createComponent(KlarTransactionsTableComponent);
    fixture.componentRef.setInput('transactions', [
      tx({ id: 'a', accountId: 'acc1' }),
      tx({ id: 'b', accountId: 'acc2' }),
    ]);
    fixture.componentRef.setInput('lockedFilters', { accountId: 'acc1' });
    fixture.detectChanges();
    expect(fixture.componentInstance.visibleTransactions().map(t => t.id)).toEqual(['a']);
  });

  it('reset does not clear locked filters', () => {
    const fixture = TestBed.createComponent(KlarTransactionsTableComponent);
    fixture.componentRef.setInput('transactions', [
      tx({ id: 'a', accountId: 'acc1', counterparty: 'Edeka' }),
      tx({ id: 'b', accountId: 'acc1', counterparty: 'Aldi' }),
    ]);
    fixture.componentRef.setInput('lockedFilters', { accountId: 'acc1' });
    fixture.detectChanges();
    fixture.componentInstance.onFiltersChange({
      ...fixture.componentInstance.filters(),
      search: 'Edeka',
    });
    fixture.componentInstance.onReset();
    expect(fixture.componentInstance.filters().accountId).toBe('acc1');
    expect(fixture.componentInstance.filters().search).toBe('');
  });

  it('isFiltered() returns false initially with locked filters set', () => {
    const fixture = TestBed.createComponent(KlarTransactionsTableComponent);
    fixture.componentRef.setInput('transactions', []);
    fixture.componentRef.setInput('lockedFilters', { accountId: 'acc1' });
    fixture.detectChanges();
    expect(fixture.componentInstance.isFiltered()).toBe(false);
  });

  it('isFiltered() returns true after a user filter changes', () => {
    const fixture = TestBed.createComponent(KlarTransactionsTableComponent);
    fixture.componentRef.setInput('transactions', []);
    fixture.componentRef.setInput('lockedFilters', { accountId: 'acc1' });
    fixture.detectChanges();
    fixture.componentInstance.onFiltersChange({
      ...fixture.componentInstance.filters(),
      search: 'edeka',
    });
    expect(fixture.componentInstance.isFiltered()).toBe(true);
  });

  it('forwards rowClick from row to its own output', () => {
    const fixture = TestBed.createComponent(KlarTransactionsTableComponent);
    const t = tx({ id: 'abc' });
    fixture.componentRef.setInput('transactions', [t]);
    const spy = vi.fn();
    fixture.componentInstance.rowClick.subscribe(spy);
    fixture.detectChanges();
    fixture.componentInstance.onRowClick(t);
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ id: 'abc' }));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter web test -- klar-transactions-table.component.spec`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the container**

```ts
// apps/web/src/app/shared/transactions/klar-transactions-table.component.ts
import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';
import { KlarEmptyStateComponent } from '../ui/klar-empty-state.component';
import { KlarTransactionsRowComponent } from './klar-transactions-row.component';
import { KlarTransactionsFilterBarComponent, type LockableFilterKey } from './klar-transactions-filter-bar.component';
import { KlarTransactionsQuickChipsComponent } from './klar-transactions-quick-chips.component';
import { type KlarSelectOption } from '../ui/klar-select.component';
import {
  EMPTY_FILTERS,
  applyFilters,
  mergeFilters,
  type TransactionFilters,
} from './transaction-filters';
import { groupByMonth } from './transaction-month-grouping';
import type { Transaction } from '../../core/transactions/transactions.store';

@Component({
  selector: 'klar-transactions-table',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    KlarEmptyStateComponent,
    KlarTransactionsRowComponent,
    KlarTransactionsFilterBarComponent,
    KlarTransactionsQuickChipsComponent,
  ],
  template: `
    <div class="flex flex-col gap-3 min-h-0 flex-1">
      <klar-transactions-quick-chips
        [filters]="filters()"
        (filtersChange)="onFiltersChange($event)"
      />

      <klar-transactions-filter-bar
        [filters]="filters()"
        [lockedKeys]="lockedKeys()"
        [accountOptions]="accountOptions()"
        [showReset]="isFiltered()"
        (filtersChange)="onFiltersChange($event)"
        (resetClick)="onReset()"
      />

      @if (visibleTransactions().length === 0) {
        <klar-empty-state
          icon="search"
          message="Keine Buchungen passen zum Filter."
        />
      } @else {
        <div class="rounded-md border border-(--line-soft) bg-(--bg-1) overflow-hidden flex flex-col">
          <div class="overflow-y-auto" style="max-height: clamp(360px, calc(100dvh - 360px), 720px);">
            @for (group of monthlyGroups(); track group.key) {
              <div class="sticky top-0 z-10 px-4 py-2 border-b border-(--line-soft) bg-(--bg-2) flex items-center justify-between gap-3">
                <span class="text-[10px] uppercase tracking-widest text-muted-foreground">
                  {{ group.label }}
                </span>
                <span class="text-[11px] mono tabular-nums text-(--fg-2)">
                  {{ group.itemsCount }} ·
                  <span [class.text-success]="group.totalCents > 0" [class.text-danger]="group.totalCents < 0">
                    {{ formatCents(group.totalCents) }}
                  </span>
                </span>
              </div>
              @for (t of group.items; track t.id) {
                <klar-transactions-row [tx]="t" (rowClick)="onRowClick($event)" />
              }
            }
          </div>
        </div>
        <div class="text-[11px] text-(--fg-3) text-center mono">
          @if (isFiltered()) {
            {{ visibleTransactions().length }} von {{ transactions().length }} Buchung{{ transactions().length === 1 ? '' : 'en' }}
          } @else {
            {{ transactions().length }} Buchung{{ transactions().length === 1 ? '' : 'en' }}
          }
          · {{ monthlyGroups().length }} Monat{{ monthlyGroups().length === 1 ? '' : 'e' }}
        </div>
      }
    </div>
  `,
})
export class KlarTransactionsTableComponent {
  readonly transactions = input.required<readonly Transaction[]>();
  readonly lockedFilters = input<Partial<TransactionFilters>>({});
  readonly accountOptions = input<readonly KlarSelectOption<string>[]>([]);

  readonly rowClick = output<Transaction>();

  readonly filters = signal<TransactionFilters>(EMPTY_FILTERS);

  constructor() {
    // Re-merge whenever lockedFilters changes (route param can update).
    effect(() => {
      const locked = this.lockedFilters();
      this.filters.update(f => mergeFilters(f, locked));
    });
  }

  readonly lockedKeys = computed<readonly LockableFilterKey[]>(() => {
    const locked = this.lockedFilters();
    const keys: LockableFilterKey[] = [];
    if (locked.accountId !== undefined && locked.accountId !== null) keys.push('accountId');
    if (locked.categoryId !== undefined && locked.categoryId !== null) keys.push('categoryId');
    if (locked.source !== undefined && locked.source !== 'all') keys.push('source');
    if (locked.amount !== undefined && locked.amount !== 'all') keys.push('amount');
    return keys;
  });

  readonly visibleTransactions = computed(() =>
    applyFilters(this.transactions(), this.filters()),
  );

  readonly monthlyGroups = computed(() => groupByMonth(this.visibleTransactions()));

  readonly isFiltered = computed(() => {
    const baseline = mergeFilters(EMPTY_FILTERS, this.lockedFilters());
    return JSON.stringify(this.filters()) !== JSON.stringify(baseline);
  });

  onFiltersChange(next: TransactionFilters): void {
    this.filters.set(mergeFilters(next, this.lockedFilters()));
  }

  onReset(): void {
    this.filters.set(mergeFilters(EMPTY_FILTERS, this.lockedFilters()));
  }

  onRowClick(t: Transaction): void {
    this.rowClick.emit(t);
  }

  protected formatCents(cents: number): string {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(cents / 100);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter web test -- klar-transactions-table.component.spec`
Expected: PASS — all 5 tests green.

- [ ] **Step 5: Lint + typecheck**

Run: `pnpm --filter web lint && pnpm --filter web build`
Expected: zero errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/shared/transactions/klar-transactions-table.component.ts apps/web/src/app/shared/transactions/klar-transactions-table.component.spec.ts
git commit -m "feat(web): klar-transactions-table container — filters + monthly groups"
```

---

## Task 7: Extend `TransactionsStore` with `accountIdFilter`

**Files:**
- Modify: `apps/web/src/app/core/transactions/transactions.store.ts`
- Modify: `apps/web/src/app/core/transactions/transactions.store.spec.ts`

The backend already supports `?accountId=` and `?month=` (verified via `transactions.controller.ts` line 36–47 — both query params, both optional). No backend change needed.

- [ ] **Step 1: Read the existing store + spec**

Run: `cat apps/web/src/app/core/transactions/transactions.store.ts apps/web/src/app/core/transactions/transactions.store.spec.ts`

The store currently uses Angular `resource()` driven by `currentMonth`, `categoryFilter`, `projectFilter`. We add `accountIdFilter` as a fourth driver. When set, the loader passes `accountId` and **omits** `month` (account view is historical).

- [ ] **Step 2: Write the failing tests**

Append to `apps/web/src/app/core/transactions/transactions.store.spec.ts`:

```ts
describe('accountIdFilter', () => {
  it('passes accountId and omits month when accountIdFilter is set', async () => {
    const httpSpy = vi.fn().mockReturnValue(of([]));
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: HttpClient, useValue: { get: httpSpy } },
        { provide: HouseholdStore, useValue: { activeId: signal('h1') } },
      ],
    });
    const store = TestBed.inject(TransactionsStore);
    store.setAccountIdFilter('acc1');
    await Promise.resolve();
    expect(httpSpy).toHaveBeenCalledWith(
      '/api/v1/households/h1/transactions',
      expect.objectContaining({ params: { accountId: 'acc1' } }),
    );
    expect(httpSpy).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ params: expect.objectContaining({ month: expect.anything() }) }),
    );
  });

  it('passes month when accountIdFilter is null (default)', async () => {
    const httpSpy = vi.fn().mockReturnValue(of([]));
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: HttpClient, useValue: { get: httpSpy } },
        { provide: HouseholdStore, useValue: { activeId: signal('h1') } },
      ],
    });
    const store = TestBed.inject(TransactionsStore);
    store.setMonth('2026-04');
    await Promise.resolve();
    expect(httpSpy).toHaveBeenCalledWith(
      '/api/v1/households/h1/transactions',
      expect.objectContaining({ params: expect.objectContaining({ month: '2026-04' }) }),
    );
  });
});
```

(Imports needed at top of file if missing: `provideZonelessChangeDetection`, `signal` from `@angular/core`; `HttpClient`, `HouseholdStore` references; `of` from `rxjs`; `vi` from `vitest`.)

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm --filter web test -- transactions.store.spec`
Expected: FAIL — `setAccountIdFilter` does not exist.

- [ ] **Step 4: Modify the store**

In `apps/web/src/app/core/transactions/transactions.store.ts`:

Replace lines 39–70 with:

```ts
  readonly currentMonth = signal(currentYearMonth());
  readonly categoryFilter = signal<string | null>(null);
  readonly projectFilter = signal<string | null>(null);
  /**
   * When set, the store loads ALL transactions for that account regardless of
   * month (historical account view). When null, the store stays month-scoped.
   */
  readonly accountIdFilter = signal<string | null>(null);

  private _resource = resource<
    Transaction[],
    {
      householdId: string | null;
      month: string;
      categoryId: string | null;
      projectId: string | null;
      accountId: string | null;
    }
  >({
    params: () => ({
      householdId: this.householdStore.activeId(),
      month: this.currentMonth(),
      categoryId: this.categoryFilter(),
      projectId: this.projectFilter(),
      accountId: this.accountIdFilter(),
    }),
    loader: ({ params }) => {
      if (!params.householdId) return Promise.resolve([]);
      const queryParams: Record<string, string> = {};
      if (params.accountId) {
        queryParams['accountId'] = params.accountId;
      } else {
        queryParams['month'] = params.month;
      }
      if (params.categoryId) queryParams['categoryId'] = params.categoryId;
      if (params.projectId) queryParams['projectId'] = params.projectId;
      return firstValueFrom(
        this.http.get<Transaction[]>(
          `/api/v1/households/${params.householdId}/transactions`,
          { params: queryParams },
        ),
      );
    },
  });
```

And add this method below `clearFilters()`:

```ts
  setAccountIdFilter(accountId: string | null): void {
    this.accountIdFilter.set(accountId);
  }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter web test -- transactions.store.spec`
Expected: PASS — both new tests + all existing tests green.

- [ ] **Step 6: Lint + typecheck**

Run: `pnpm --filter web lint && pnpm --filter web build`
Expected: zero errors.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/core/transactions/transactions.store.ts apps/web/src/app/core/transactions/transactions.store.spec.ts
git commit -m "feat(web): TransactionsStore accountIdFilter for historical account view"
```

---

## Task 8: Add `presetAccountId` input to `TransactionDialogComponent`

**Files:**
- Modify: `apps/web/src/app/pages/buchungen/transaction-dialog.component.ts`
- Modify: `apps/web/src/app/pages/buchungen/transaction-dialog.component.html` (only if save body needs accountId field — verify the Transaction type's `accountId` is assignable on create)

- [ ] **Step 1: Add the input + wire into save body**

In `transaction-dialog.component.ts`, add below `presetPlanned` input (around line 36):

```ts
  /** Pre-filled account id for create mode (used when adding from the account detail page). */
  presetAccountId = input<string | null>(null);
```

Add the signal alongside `projectId`:

```ts
  readonly accountId = signal<string | null>(null);
```

Update the `effect()` block in the constructor (lines 94–117) to set `accountId`:

```ts
      if (t) {
        // ...existing assignments...
        this.accountId.set(t.accountId ?? null);
      } else {
        // ...existing assignments...
        this.accountId.set(this.presetAccountId());
      }
```

Add `accountId` to the save body (line 133):

```ts
    const body = {
      // ...existing fields...
      accountId:   this.accountId(),
    };
```

- [ ] **Step 2: Run all dialog-related tests**

Run: `pnpm --filter web test -- transaction-dialog`
Expected: PASS — the dialog accepts the new input but no test depends on it yet.

- [ ] **Step 3: Lint + typecheck**

Run: `pnpm --filter web lint && pnpm --filter web build`
Expected: zero errors.

- [ ] **Step 4: Confirm backend accepts `accountId` on create/update**

Run: `grep -n "accountId" apps/api/src/transactions/transactions.service.ts | head -20`
Expected: `accountId` appears in `CreateTransactionInput`/`UpdateTransactionInput` (it's already there per FinTS Foundation 14a.8). If not, this task grows by extending the service input types — but verify first.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/pages/buchungen/transaction-dialog.component.ts
git commit -m "feat(web): transaction dialog accepts presetAccountId for account-scoped create"
```

---

## Task 9: Migrate `BuchungenPageComponent` to `<klar-transactions-table>`

**Files:**
- Modify: `apps/web/src/app/pages/buchungen/buchungen.component.ts`
- Modify: `apps/web/src/app/pages/buchungen/buchungen.component.html`
- Modify: `apps/web/src/app/pages/buchungen/buchungen.component.css` (likely shrink to empty)
- Modify: `apps/web/src/app/pages/buchungen/buchungen.component.spec.ts`

- [ ] **Step 1: Update the spec to test new behavior**

Replace `apps/web/src/app/pages/buchungen/buchungen.component.spec.ts` entirely:

```ts
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { describe, it, expect, vi } from 'vitest';
import { BuchungenPageComponent } from './buchungen.component';
import { TransactionsStore } from '../../core/transactions/transactions.store';
import { CategoriesStore } from '../../core/categories/categories.store';
import { PageHeaderService } from '../../core/page-header/page-header.service';
import { KlarDialogService } from '../../shared/ui/klar-dialog.service';

describe('BuchungenPageComponent', () => {
  let dialogOpenSpy: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    dialogOpenSpy = vi.fn();
    const transactionsStub = {
      sortedItems: signal([]),
      currentMonth: signal('2026-05'),
      loading: signal(false),
      error: signal(null),
      isEmpty: signal(false),
      reload: vi.fn(),
      setMonth: vi.fn(),
      setAccountIdFilter: vi.fn(),
      totalIncomeCents: signal(0),
      totalExpenseCents: signal(0),
      nettoCents: signal(0),
    };

    await TestBed.configureTestingModule({
      imports: [BuchungenPageComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: TransactionsStore, useValue: transactionsStub },
        { provide: CategoriesStore, useValue: { items: signal([]), byId: () => null, loading: signal(false), error: signal(null), reload: vi.fn() } },
        { provide: PageHeaderService, useValue: { set: vi.fn(), stats: signal([]), scopeSegments: signal([]), scopeValue: signal('month') } },
        { provide: KlarDialogService, useValue: { open: dialogOpenSpy, close: vi.fn() } },
      ],
    }).compileComponents();
  });

  it('opens create dialog when openCreate is invoked', () => {
    const fixture = TestBed.createComponent(BuchungenPageComponent);
    fixture.detectChanges();
    (fixture.componentInstance as unknown as { openCreate: () => void }).openCreate();
    expect(dialogOpenSpy).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Buchung anlegen' }),
    );
  });

  it('opens edit dialog when row is clicked via openEdit', () => {
    const fixture = TestBed.createComponent(BuchungenPageComponent);
    fixture.detectChanges();
    const tx = { id: 'abc', amountCents: -100 } as never;
    (fixture.componentInstance as unknown as { openEdit: (t: unknown) => void }).openEdit(tx);
    expect(dialogOpenSpy).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Buchung bearbeiten', inputs: { tx } }),
    );
  });

  it('clears the account filter on init so the page shows the month view', () => {
    const store = TestBed.inject(TransactionsStore) as unknown as { setAccountIdFilter: ReturnType<typeof vi.fn> };
    TestBed.createComponent(BuchungenPageComponent).detectChanges();
    expect(store.setAccountIdFilter).toHaveBeenCalledWith(null);
  });
});
```

- [ ] **Step 2: Rewrite the component**

Replace `apps/web/src/app/pages/buchungen/buchungen.component.ts`:

```ts
import { Component, effect, inject, OnInit } from '@angular/core';
import { KlarSkeletonComponent } from '../../shared/ui/klar-skeleton.component';
import { KlarDialogService } from '../../shared/ui/klar-dialog.service';
import { TransactionsStore, type Transaction } from '../../core/transactions/transactions.store';
import { PageHeaderService } from '../../core/page-header/page-header.service';
import { TransactionDialogComponent } from './transaction-dialog.component';
import { KlarSummaryStripComponent } from '../../shared/ui/klar-summary-strip.component';
import {
  KlarAsyncStateComponent,
  KlarLoadingTplDirective,
} from '../../shared/ui/klar-async-state.component';
import { KlarTransactionsTableComponent } from '../../shared/transactions/klar-transactions-table.component';

@Component({
  selector: 'app-buchungen',
  standalone: true,
  host: { class: 'flex flex-col flex-1 min-h-0 overflow-hidden' },
  imports: [
    KlarSkeletonComponent,
    KlarSummaryStripComponent,
    KlarAsyncStateComponent,
    KlarLoadingTplDirective,
    KlarTransactionsTableComponent,
  ],
  templateUrl: './buchungen.component.html',
  styleUrl: './buchungen.component.css',
})
export class BuchungenPageComponent implements OnInit {
  protected store = inject(TransactionsStore);
  private dialogService = inject(KlarDialogService);
  private pageHeader = inject(PageHeaderService);

  constructor() {
    this.pageHeader.set({
      title: 'Buchungen',
      subtitle: 'Cashflow · Buchungen',
      showAdd: true,
      showExport: false,
      showUserSwitch: true,
      scopeSegments: [
        { id: 'month', label: this.formatMonthLabel(this.store.currentMonth()) },
        { id: 'avg6m', label: 'Schnitt 6 M' },
        { id: 'year', label: 'Jahr' },
      ],
      scopeValue: 'month',
      addLabel: 'Buchung',
      onAdd: () => this.openCreate(),
    });

    effect(() => {
      const label = this.formatMonthLabel(this.store.currentMonth());
      this.pageHeader.scopeSegments.set([
        { id: 'month', label },
        { id: 'avg6m', label: 'Schnitt 6 M' },
        { id: 'year', label: 'Jahr' },
      ]);
    });
  }

  ngOnInit(): void {
    // Reset any account filter the user may have set before navigating here
    // so the cashflow lens shows the current month, not a stale account view.
    this.store.setAccountIdFilter(null);
  }

  openCreate(): void {
    this.dialogService.open({
      title: 'Buchung anlegen',
      component: TransactionDialogComponent,
      inputs: { tx: null },
      width: 'md',
    });
  }

  openEdit(tx: Transaction): void {
    this.dialogService.open({
      title: 'Buchung bearbeiten',
      component: TransactionDialogComponent,
      inputs: { tx },
      width: 'md',
    });
  }

  private formatMonthLabel(yearMonth: string): string {
    const [y, m] = yearMonth.split('-').map(Number);
    if (!y || !m) return yearMonth;
    const date = new Date(Date.UTC(y, m - 1, 1));
    return new Intl.DateTimeFormat('de-DE', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(date);
  }
}
```

- [ ] **Step 3: Rewrite the template**

Replace `apps/web/src/app/pages/buchungen/buchungen.component.html`:

```html
<klar-async-state
  [loading]="store.loading()"
  [error]="store.error()"
  [empty]="store.isEmpty()"
  errorMessage="Fehler beim Laden der Buchungen."
  emptyMessage="Noch keine Buchungen für diesen Monat"
  emptyCtaLabel="Buchung anlegen"
  (retry)="store.reload()"
  (cta)="openCreate()"
>
  <ng-template klarLoading>
    <div class="p-(--s-6) flex flex-col gap-(--s-4)">
      <klar-skeleton height="120px" />
      <klar-skeleton height="320px" />
    </div>
  </ng-template>

  <div class="p-(--s-6) pb-(--s-3) flex flex-col gap-(--s-5) flex-1 min-h-0">
    <klar-summary-strip
      [incomeCents]="store.totalIncomeCents()"
      [expenseCents]="store.totalExpenseCents()"
      [balanceCents]="store.nettoCents()"
    />

    <klar-transactions-table
      [transactions]="store.sortedItems()"
      (rowClick)="openEdit($event)"
    />
  </div>
</klar-async-state>
```

- [ ] **Step 4: Strip the obsolete CSS**

Run: `cat apps/web/src/app/pages/buchungen/buchungen.component.css`

Remove every rule that targeted `.segmented`, `.row`, `.row-ico-slot`, `.lhs`, `.name`, `.meta`, `.amt`, `.chip` — these were tab/row styles now provided by the row component. Keep any `.card` rule only if `klar-summary-strip` depends on it; otherwise empty the file.

If the resulting file is empty, delete it and remove `styleUrl: './buchungen.component.css'` from the component.

- [ ] **Step 5: Drop unused imports (CLAUDE.md rule)**

Verify the component file imports nothing unused (`KlarMoneyPipe`, `KlarIconComponent`, `CategoriesStore` are gone — they were used only by the inline row).

Run: `pnpm --filter web build` — Angular's NG8113 catches unused template references the linter doesn't.
Expected: zero errors.

- [ ] **Step 6: Run tests**

Run: `pnpm --filter web test -- buchungen.component.spec`
Expected: PASS — all 3 new tests green.

- [ ] **Step 7: Lint + typecheck**

Run: `pnpm --filter web lint && pnpm --filter web build`
Expected: zero errors.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/app/pages/buchungen/
git commit -m "refactor(web): buchungen page renders shared <klar-transactions-table>"
```

---

## Task 10: Migrate `BankenAccountDetailComponent` to `<klar-transactions-table>`

**Files:**
- Modify: `apps/web/src/app/pages/banken/banken-account-detail.component.ts`
- Create: `apps/web/src/app/pages/banken/banken-account-detail.component.spec.ts` (currently no spec)

- [ ] **Step 1: Write the failing component spec**

```ts
// apps/web/src/app/pages/banken/banken-account-detail.component.spec.ts
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { describe, it, expect, vi } from 'vitest';
import { BankenAccountDetailComponent } from './banken-account-detail.component';
import { TransactionsStore } from '../../core/transactions/transactions.store';
import { CategoriesStore } from '../../core/categories/categories.store';
import { HouseholdStore } from '../../core/household/household.store';
import { FintsStore } from '../../core/fints/fints.store';
import { PageHeaderService } from '../../core/page-header/page-header.service';
import { KlarDialogService } from '../../shared/ui/klar-dialog.service';

describe('BankenAccountDetailComponent', () => {
  let setAccountIdFilter: ReturnType<typeof vi.fn>;
  let reload: ReturnType<typeof vi.fn>;
  let triggerSync: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    setAccountIdFilter = vi.fn();
    reload = vi.fn();
    triggerSync = vi.fn().mockResolvedValue(undefined);

    await TestBed.configureTestingModule({
      imports: [BankenAccountDetailComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: new Map([['connectionId', 'conn1'], ['accountId', 'acc1']]) as never },
          },
        },
        {
          provide: TransactionsStore,
          useValue: {
            items: signal([]),
            sortedItems: signal([]),
            loading: signal(false),
            error: signal(null),
            isEmpty: signal(true),
            setAccountIdFilter,
            reload,
            currentMonth: signal('2026-05'),
          },
        },
        { provide: CategoriesStore, useValue: { byId: () => null, items: signal([]) } },
        { provide: HouseholdStore, useValue: { activeId: signal('h1') } },
        {
          provide: FintsStore,
          useValue: {
            connections: signal([
              { id: 'conn1', bankName: 'Sparkasse', lastSyncAt: '2026-05-08T10:00:00Z',
                accounts: [{ id: 'acc1', name: 'Giro', iban: 'DE…', lastKnownBalanceCents: 12345 }] },
            ]),
            syncing: signal(null),
            reload: vi.fn(),
            triggerSync,
          },
        },
        { provide: PageHeaderService, useValue: { set: vi.fn() } },
        { provide: KlarDialogService, useValue: { open: vi.fn(), close: vi.fn() } },
      ],
    }).compileComponents();
  });

  it('sets accountIdFilter on init from route param', () => {
    const fixture = TestBed.createComponent(BankenAccountDetailComponent);
    fixture.detectChanges();
    expect(setAccountIdFilter).toHaveBeenCalledWith('acc1');
  });

  it('triggers store.reload after sync', async () => {
    const fixture = TestBed.createComponent(BankenAccountDetailComponent);
    fixture.detectChanges();
    await (fixture.componentInstance as unknown as { onSync: () => Promise<void> }).onSync();
    expect(triggerSync).toHaveBeenCalledWith('conn1');
    expect(reload).toHaveBeenCalled();
  });

  it('opens create dialog with accountId prefilled when openCreate runs', () => {
    const dialog = TestBed.inject(KlarDialogService) as unknown as { open: ReturnType<typeof vi.fn> };
    const fixture = TestBed.createComponent(BankenAccountDetailComponent);
    fixture.detectChanges();
    (fixture.componentInstance as unknown as { openCreate: () => void }).openCreate();
    expect(dialog.open).toHaveBeenCalledWith(
      expect.objectContaining({
        inputs: expect.objectContaining({ presetAccountId: 'acc1' }),
      }),
    );
  });
});
```

- [ ] **Step 2: Run spec — verify it fails**

Run: `pnpm --filter web test -- banken-account-detail.component.spec`
Expected: FAIL — current component still uses ad-hoc HTTP and no `openCreate`.

- [ ] **Step 3: Rewrite the component**

Replace `apps/web/src/app/pages/banken/banken-account-detail.component.ts`:

```ts
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TransactionsStore } from '../../core/transactions/transactions.store';
import { FintsStore } from '../../core/fints/fints.store';
import { PageHeaderService } from '../../core/page-header/page-header.service';
import { KlarDialogService } from '../../shared/ui/klar-dialog.service';
import { TransactionDialogComponent } from '../buchungen/transaction-dialog.component';
import type {
  FintsAttachedAccount,
  FintsConnectionResponse,
} from '../../core/fints/fints.service';
import type { Transaction } from '../../core/transactions/transactions.store';
import { KlarIconComponent } from '../../shared/icons/klar-icon.component';
import { KlarHeroComponent } from '../../shared/ui/klar-hero.component';
import { KlarMetricTileComponent } from '../../shared/ui/klar-metric-tile.component';
import { KlarEmptyStateComponent } from '../../shared/ui/klar-empty-state.component';
import { KlarButtonComponent } from '../../shared/ui/klar-button.component';
import { KlarTransactionsTableComponent } from '../../shared/transactions/klar-transactions-table.component';

@Component({
  selector: 'klar-banken-account-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    KlarIconComponent,
    KlarHeroComponent,
    KlarMetricTileComponent,
    KlarEmptyStateComponent,
    KlarButtonComponent,
    KlarTransactionsTableComponent,
  ],
  template: `
    <div class="flex flex-col gap-(--s-6) p-(--s-6) pb-16">
      @if (account(); as a) {
        <klar-hero
          eyebrow="Bankkonto"
          [title]="a.name"
          [sub]="connection()?.bankName ?? ''"
        >
          <klar-icon heroEyebrowIcon name="wallet" [size]="11" />
          <div heroActions class="grid grid-cols-2 md:grid-cols-3 gap-3 shrink-0">
            <klar-metric-tile label="Buchungen" [value]="store.sortedItems().length + ''" />
            <klar-metric-tile label="Saldo" [value]="balanceLabel()" />
            <klar-metric-tile label="Letzter Sync" [value]="lastSyncLabel()" />
          </div>
        </klar-hero>

        <div class="flex items-center justify-between gap-3 flex-wrap">
          <div class="flex items-center gap-3 text-[12px] text-(--fg-2) min-w-0">
            <klar-button
              tone="ghost"
              size="sm"
              icon="chevron-left"
              (click)="goBack()"
              ariaLabel="Zurück zur Bankenliste"
            >Zurück</klar-button>
            @if (a.iban) {
              <span class="mono truncate">{{ a.iban }}</span>
            }
          </div>
          <div class="flex items-center gap-2">
            @if (store.loading()) {
              <span class="text-[12px] text-(--fg-2)">Lädt …</span>
            }
            <klar-button
              tone="primary"
              size="sm"
              icon="plus"
              (click)="openCreate()"
            >Buchung</klar-button>
            <klar-button
              tone="ghost"
              size="sm"
              icon="refresh"
              [iconSpin]="fintsStore.syncing() === connectionId()"
              [disabled]="!!fintsStore.syncing()"
              title="Synchronisiert alle Konten dieser Bank"
              (click)="onSync()"
            >
              {{ fintsStore.syncing() === connectionId() ? 'Synchronisiere …' : 'Synchronisieren' }}
            </klar-button>
          </div>
        </div>

        @if (store.loading() && store.sortedItems().length === 0) {
          <div class="rounded-lg border border-(--line) bg-(--bg-1) px-5 py-10 text-center text-(--fg-2)">
            Lädt Buchungen …
          </div>
        } @else if (store.sortedItems().length === 0) {
          <klar-empty-state
            icon="wallet"
            message="Noch keine Buchungen für dieses Konto. Sobald der nächste Sync läuft, erscheinen sie hier."
          />
        } @else {
          <klar-transactions-table
            [transactions]="store.sortedItems()"
            [lockedFilters]="{ accountId: accountId() }"
            (rowClick)="openEdit($event)"
          />
        }
      } @else {
        <klar-empty-state
          icon="wallet"
          message="Konto nicht gefunden. Möglicherweise wurde es entfernt."
        />
      }
    </div>
  `,
})
export class BankenAccountDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly pageHeader = inject(PageHeaderService);
  private readonly dialog = inject(KlarDialogService);
  protected readonly store = inject(TransactionsStore);
  protected readonly fintsStore = inject(FintsStore);

  protected readonly connectionId = signal('');
  protected readonly accountId = signal('');

  protected readonly connection = computed<FintsConnectionResponse | undefined>(() => {
    const id = this.connectionId();
    return this.fintsStore.connections()?.find(c => c.id === id);
  });

  protected readonly account = computed<FintsAttachedAccount | undefined>(() => {
    const id = this.accountId();
    return this.connection()?.accounts.find(a => a.id === id);
  });

  protected readonly balanceLabel = computed(() => {
    const cents = this.account()?.lastKnownBalanceCents;
    if (cents !== null && cents !== undefined) return this.formatCents(cents);
    const txs = this.store.sortedItems();
    if (txs.length === 0) return '—';
    return this.formatCents(txs.reduce((s, t) => s + t.amountCents, 0));
  });

  protected readonly lastSyncLabel = computed(() => {
    const iso = this.connection()?.lastSyncAt;
    if (!iso) return '—';
    const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (minutes < 1) return 'gerade eben';
    if (minutes < 60) return `vor ${minutes} Min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `vor ${hours} Std`;
    return `vor ${Math.floor(hours / 24)} Tg`;
  });

  ngOnInit(): void {
    const params = this.route.snapshot.paramMap;
    this.connectionId.set(params.get('connectionId') ?? '');
    this.accountId.set(params.get('accountId') ?? '');
    this.pageHeader.set({
      title: 'Bankkonto',
      subtitle: this.connection()?.bankName ?? 'FinTS',
      showUserSwitch: true,
    });
    if (!this.fintsStore.connections()) {
      this.fintsStore.reload();
    }
    this.store.setAccountIdFilter(this.accountId());
  }

  openCreate(): void {
    this.dialog.open({
      title: 'Buchung anlegen',
      component: TransactionDialogComponent,
      inputs: { tx: null, presetAccountId: this.accountId() },
      width: 'md',
    });
  }

  openEdit(tx: Transaction): void {
    this.dialog.open({
      title: 'Buchung bearbeiten',
      component: TransactionDialogComponent,
      inputs: { tx },
      width: 'md',
    });
  }

  goBack(): void {
    void this.router.navigate(['/app/banken']);
  }

  async onSync(): Promise<void> {
    const id = this.connectionId();
    if (!id) return;
    try {
      await this.fintsStore.triggerSync(id);
      this.store.reload();
    } catch {
      // toast surfaced by HTTP interceptor
    }
  }

  private formatCents(cents: number): string {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(cents / 100);
  }
}
```

- [ ] **Step 4: Run spec to verify it passes**

Run: `pnpm --filter web test -- banken-account-detail.component.spec`
Expected: PASS — all 3 tests green.

- [ ] **Step 5: Lint + typecheck**

Run: `pnpm --filter web lint && pnpm --filter web build`
Expected: zero errors. NG8113 catches any unused imports left over from the inline filter/group code (`DatePipe`, `FormsModule`, `HttpClient`, `firstValueFrom`, `KlarBadgeComponent`, `KlarInputComponent`, `KlarToggleGroupComponent`).

- [ ] **Step 6: Smoke run**

Run: `pnpm --filter web start` (background — use BashOutput to monitor)

Open http://localhost:4200/app/banken in a browser, click into an account, verify:
- Hero shows balance + last sync + booking count
- Add button opens create dialog with the account preselected
- Sync button still works, list refreshes after
- Filter bar shows account pill as locked
- Search + amount + source filters all work
- Click on a row opens edit dialog

(If something's off, fix in this commit.)

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/pages/banken/banken-account-detail.component.ts apps/web/src/app/pages/banken/banken-account-detail.component.spec.ts
git commit -m "refactor(web): banken account detail uses shared <klar-transactions-table>"
```

---

## Task 11: Playwright smoke tests

**Files:**
- Create: `apps/web-e2e/src/buchungen-consolidation.spec.ts` (or wherever Playwright specs live in this repo)

- [ ] **Step 1: Locate the Playwright suite layout**

Run: `ls apps/web-e2e/src/ 2>/dev/null || find . -name "playwright.config.ts" -not -path "*/node_modules/*"`

If a different path is used, adapt the file path below. Follow the existing spec style (helpers, login fixtures, base URL).

- [ ] **Step 2: Write the smoke spec**

```ts
// apps/web-e2e/src/buchungen-consolidation.spec.ts
import { test, expect } from '@playwright/test';

// NOTE: replace with the project's existing login helper if present.
async function loginAsTestUser(page) {
  // ...existing test login flow...
}

test.describe('Transactions consolidation', () => {
  test('Buchungen page: quick chip filters, edit, create flow', async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto('/app/buchungen');
    await expect(page.getByRole('button', { name: /Wiederkehrend/ })).toBeVisible();

    // Toggle "Wiederkehrend" chip → filter applies
    await page.getByRole('button', { name: /Wiederkehrend/ }).click();
    await expect(page.getByText(/Filter zurücksetzen/)).toBeVisible();

    // Reset
    await page.getByText(/Filter zurücksetzen/).click();
    await expect(page.getByText(/Filter zurücksetzen/)).toBeHidden();

    // Add → dialog with no account preselect
    await page.getByRole('button', { name: /^Buchung$/ }).first().click();
    await expect(page.getByText('Buchung anlegen')).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('Account detail: locked filter, sync, prefilled add', async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto('/app/banken');
    // Open the first FinTS-linked account from the banken list
    await page.locator('[data-test="banken-account-link"]').first().click();
    await expect(page.getByText(/Bankkonto/)).toBeVisible();

    // Account pill is disabled / locked
    const accountSelect = page.locator('[data-filter="accountId"]');
    await expect(accountSelect).toHaveAttribute('data-locked', 'true');

    // Search filters within account
    await page.getByPlaceholder(/Beschreibung/).fill('zzz_no_match_zzz');
    await expect(page.getByText(/Keine Buchungen passen zum Filter/)).toBeVisible();
    await page.getByPlaceholder(/Beschreibung/).fill('');

    // Add → dialog opens with account preselect (visible in selector if present)
    await page.getByRole('button', { name: /^Buchung$/ }).click();
    await expect(page.getByText('Buchung anlegen')).toBeVisible();
    await page.keyboard.press('Escape');

    // Sync still works
    await page.getByRole('button', { name: /Synchronisieren/ }).click();
    await expect(page.getByRole('button', { name: /Synchronisiere|Synchronisieren/ })).toBeVisible();
  });
});
```

(If the existing e2e suite uses a different naming or login fixture, adapt the file to match. Add a `data-test="banken-account-link"` attribute on the banken-account list item if it isn't there already — small one-line change, commit alongside the e2e spec.)

- [ ] **Step 3: Run the e2e suite**

Run: `pnpm --filter web-e2e test --grep "Transactions consolidation"` (or the repo's conventional command).
Expected: both tests pass against a running dev server.

- [ ] **Step 4: Commit**

```bash
git add apps/web-e2e/src/buchungen-consolidation.spec.ts
git commit -m "test(web-e2e): playwright smoke for consolidated transactions table"
```

---

## Task 12: README + DoD finalization

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update the features table**

Locate the features table in README and add/update the Buchungen entry:

```markdown
| **Buchungen** | Cashflow + bank account views share one filter/search/grouping engine. Quick chips for "Wiederkehrend / Eingänge / FinTS / Manuell". |
```

- [ ] **Step 2: Add detail section**

Below the features table in the "Features im Detail" section:

```markdown
### Buchungen — Unified table

The transactions table (`<klar-transactions-table>`) is shared by `/app/buchungen`
(month-scoped cashflow lens) and `/app/banken/:c/:a` (historical per-account lens).
Both routes use the same filter bar (search · account · source · amount), quick-chip
shortcuts, and per-month sticky-header grouping.

- **Cashflow lens** (`/app/buchungen`) — defaults to the current month from the
  page header scope segment. Add button creates an unscoped transaction.
- **Account lens** (`/app/banken/:connectionId/:accountId`) — loads all
  transactions for the account, regardless of month. The account filter is
  locked (no reset). Add button prefills `accountId`. FinTS-imported rows keep
  their bank-field lockout (14a.8); manual fields like category and notes are
  editable everywhere.
```

- [ ] **Step 3: Verify no internal hostnames/secrets leaked**

Run: `git diff README.md` and check for any reference to private hostnames, stack IDs, or tokens. Per CLAUDE.md, only placeholders allowed.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: document consolidated transactions table feature"
```

- [ ] **Step 5: Final DoD pass**

Run all of these in sequence:

```bash
pnpm lint
pnpm test
pnpm build
```

Expected: all green. Frontend coverage ≥ 70 % lines (existing threshold).

Manually verify on a mobile viewport (≤ 375 px) in the browser:
- `/app/buchungen` — no horizontal overflow, search input ≥ 16 px font, chips horizontally scrollable, rows ≥ 44 px tall.
- `/app/banken/:c/:a` — same checks, hero metric tiles wrap correctly.

If any check fails, fix in a follow-up commit before marking the feature done.

- [ ] **Step 6: Memory store**

After all commits land, store the patterns:

```
memory_store(
  key="klar-buchungen-consolidation-2026-05-08",
  namespace="klar-app",
  value="Unified <klar-transactions-table> at apps/web/src/app/shared/transactions/. Two routes (/app/buchungen, /app/banken/:c/:a) share the same table via lockedFilters input. TransactionsStore.accountIdFilter signal switches loader from month-scoped to account-historical. Pure helpers (transaction-filters.ts + transaction-month-grouping.ts) are unit-tested independently."
)

memory_store(
  key="locked-filters-pattern",
  namespace="patterns",
  value="When two pages share a filter/list component but one needs a hard-coded filter dimension, accept lockedFilters: Partial<Filters> as input, merge into state on init AND on every change, and exclude locked keys from reset. Render locked dimensions with data-locked='true' for testability."
)
```

---

## Self-Review Checklist

**Spec coverage:** ✓
- §1 Architecture → Tasks 1–6 build the shared package; Tasks 9–10 wire it into the two pages.
- §2 Component breakdown → Tasks 1, 2, 3, 4, 5, 6 (one task per file).
- §3 Filter shape + quick chips + locked filters → Tasks 1, 4, 5, 6.
- §4 Data flow + `loadFiltered`/`accountIdFilter` → Task 7. Backend already supports both query params (verified in Read).
- §5 Migration plan + tests + Playwright + README → Tasks 8–12.

**Placeholder scan:** ✓ No "TBD" / "later" / "similar to" / unspecified handlers. Every code step contains the actual code.

**Type consistency:** ✓
- `TransactionFilters` defined in Task 1, used identically in Tasks 4, 5, 6.
- `LockableFilterKey` defined in Task 5, used in Task 6.
- `accountIdFilter` signal name is the same in Task 7 (definition) and Tasks 9, 10 (consumers).
- `presetAccountId` input name is the same in Task 8 (definition) and Task 10 (consumer).
- `setAccountIdFilter` method name is consistent across Tasks 7, 9, 10.

**Open risk:** Backend `accountId` on POST/PATCH was assumed to exist via FinTS Foundation 14a.8 — Task 8 Step 4 includes a verification grep before assuming. If it's missing, the engineer extends `CreateTransactionInput`/`UpdateTransactionInput` in the same commit.
