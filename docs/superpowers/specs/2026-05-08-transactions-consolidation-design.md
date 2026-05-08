# Transactions Consolidation Design

**Date:** 2026-05-08
**Status:** Approved
**Owner:** Marco

## Problem

Two transaction list views exist with overlapping but slightly different UI and logic:

- `/app/buchungen` — global transactions, month-scoped, four tab filters (`alle/rec/manual/income`), edit on row click, add button, summary strip (income/expense/netto). No account filter, no search, no source filter.
- `/app/banken/:connectionId/:accountId` — single-account view, hero with balance + last sync + sync button, filter bar (search · amount direction · source), monthly groups with sticky headers + per-month sums. Read-only (no row click, no add).

The duplication causes:

- Two separate list rendering implementations.
- Two separate filter logics that drift over time.
- Two data sources (`TransactionsStore` vs. ad-hoc `HttpClient` call inside `BankenAccountDetailComponent`).
- Gaps in both directions (Buchungen page has no account filter; account detail can't edit FinTS-locked manual fields, can't add corrections).

## Goal

One canonical transactions table component used by both routes. Two distinct entry points (Cashflow lens · Account lens) keep their distinct headers and pre-applied filters, but share rendering, filtering, grouping, and editing.

## Non-Goals

- Changing the route URLs. Both `/app/buchungen` and `/app/banken/:c/:a` stay.
- Moving manual editing semantics. FinTS field lockout (14a.8) remains as-is.
- Persisting filter state across sessions.
- Backend schema changes.

## Decisions Made During Brainstorming

| Question | Decision |
|---|---|
| Mental axis | Both lenses equally valid (Cashflow + Account), but one canonical table underneath. |
| Routing | Two routes share one table. `/app/buchungen` keeps cashflow lens; `/app/banken/:c/:a` keeps account lens. |
| Filter UI | Single filter bar with quick-chip shortcuts above. No tabs. |
| Monthly grouping | Always on, in both routes. |
| Edit on account view | Yes — full edit dialog with existing FinTS field lockout. |
| Add on account view | Yes — Add button visible, `accountId` prefilled from route. |

## Architecture

A new domain-shared component lives in `apps/web/src/app/shared/transactions/`:

```
shared/transactions/
  klar-transactions-table.component.ts       # Container
  klar-transactions-filter-bar.component.ts  # Search + selects + toggle groups + reset
  klar-transactions-quick-chips.component.ts # 4 fixed shortcut chips
  klar-transactions-row.component.ts         # Single row presentation
  transaction-filters.ts                     # Filter type + applyFilters() + EMPTY_FILTERS
  transaction-month-grouping.ts              # groupByMonth() pure helper
```

Both pages become thin: header + (hero or summary strip) + `<klar-transactions-table>` + add button handler. The route is responsible for telling the table which filters are locked.

### Container interface

```ts
@Component({ selector: 'klar-transactions-table', ... })
class KlarTransactionsTableComponent {
  readonly transactions = input.required<Transaction[]>();
  readonly lockedFilters = input<Partial<TransactionFilters>>({});

  readonly rowClick = output<Transaction>();
}
```

`lockedFilters` are merged into the initial state, displayed in the filter bar as locked pills (no remove icon), and not cleared by the reset button.

### Filter shape

```ts
type AmountFilter = 'all' | 'income' | 'expense';
type SourceFilter = 'all' | 'fints' | 'manual' | 'csv' | 'csv-import';
type RecurringFilter = 'all' | 'recurring' | 'manual';

interface TransactionFilters {
  search: string;
  accountId: string | null;
  categoryId: string | null;
  source: SourceFilter;
  amount: AmountFilter;
  recurring: RecurringFilter;
}

const EMPTY_FILTERS: TransactionFilters = {
  search: '', accountId: null, categoryId: null,
  source: 'all', amount: 'all', recurring: 'all',
};
```

`applyFilters(items, filters)` is a pure function. Search matches `description + counterparty` (case-fold). All other filters are exact matches (with `'all'` / `null` meaning unrestricted).

### Quick chips

Four fixed toggles, each driving a single filter dimension:

| Chip | Sets |
|---|---|
| Wiederkehrend | `recurring: 'recurring'` |
| Eingänge | `amount: 'income'` |
| FinTS | `source: 'fints'` |
| Manuell | `source: 'manual'` |

Active chip uses `bg-(--bg-3) text-(--fg)`. Click toggles the dimension back to `'all'`. Multiple chips combine as AND (different dimensions).

### Monthly grouping

`groupByMonth(items)` returns `MonthGroup[]` ordered newest-first, each with `key (YYYY-MM)`, `label` (German long month), `items`, `itemsCount`, `totalCents`, `totalLabel`. Sticky headers per group, per-month sum colored success/danger by sign.

Always on — no toggle. Replaces the flat list rendering on the Buchungen page.

### `isFiltered()` computed

True when current filters differ from `merged(EMPTY_FILTERS, lockedFilters)`. Reset button only resets the user-controllable diff, never the locked filters.

## Data flow

### `TransactionsStore` extension

Today the store loads only the current month. Account detail bypasses with an ad-hoc `HttpClient.get()`. We unify:

```ts
class TransactionsStore extends ResourceStore<Transaction> {
  readonly query = signal<{ accountId?: string; month?: string }>({});

  loadFiltered(q: { accountId?: string; month?: string }): void {
    this.query.set(q);
    this.reload();
  }
}
```

`reload()` builds the URL based on `query()`:

- Neither `accountId` nor `month` → ledger of last 6 months (reasonable filter range).
- `accountId` only → all transactions for the account, no month limit (account view is historical).
- `month` only → existing month-scoped behavior.

### Page integration

**`BuchungenPageComponent`:**

```ts
ngOnInit() {
  this.store.loadFiltered({ month: this.store.currentMonth() });
}
// template:
// <klar-summary-strip ... />
// <klar-transactions-table
//   [transactions]="store.sortedItems()"
//   (rowClick)="openEdit($event)"
// />
```

**`BankenAccountDetailComponent`:**

```ts
ngOnInit() {
  this.store.loadFiltered({ accountId: this.accountId() });
}
// template:
// <klar-hero ...>... metric tiles ...</klar-hero>
// <klar-transactions-table
//   [transactions]="store.items()"
//   [lockedFilters]="{ accountId: accountId() }"
//   (rowClick)="openEdit($event)"
// />

protected onSync() {
  await this.fintsStore.triggerSync(this.connectionId());
  this.store.reload();
}
```

The local `transactions` signal and the ad-hoc `HttpClient.get()` call are removed. Hero metrics (booking count, balance fallback) read from `store.items()`.

### Backend

`apps/api/src/transactions/transactions.controller.ts` already supports `?accountId=`. Verify it also accepts `?month=YYYY-MM` and that both can combine. If the controller already handles both, no change. Otherwise extend the repository filter build to AND both clauses.

Tenancy unchanged: `householdId` continues to come from `:hid` URL param via `HouseholdMemberGuard`. RLS unchanged. Frontend never passes `householdId`.

## Editing semantics

Row click on either route opens the existing `TransactionDialogComponent` in edit mode. FinTS-imported transactions retain the field lockout from 14a.8 (bank-controlled fields disabled, manual fields like category and notes editable).

Add button:

- On `/app/buchungen`: opens `TransactionDialogComponent` with `tx: null`. No prefilled `accountId`.
- On `/app/banken/:c/:a`: opens `TransactionDialogComponent` with `tx: null` and `prefill: { accountId }`. The dialog already supports `accountId` selection; we add an optional `prefill` input.

After create/edit/delete, the dialog calls `store.reload()`. The store reuses its active query, so both routes refresh correctly.

## Mobile / iOS rules

- Search input uses `text-base` (16px) — Safari zoom rule.
- Filter bar wraps on mobile: search full-width on top, filter row horizontal-scrollable below.
- Quick chips: horizontal scroll-snap on mobile.
- Sticky month headers respect existing safe-area insets via `--safe-top`.
- Monthly group totals use `mono tabular-nums` (existing convention).
- Row min-height ≥ 44px for touch.

## File-level changes

**New:**

- `apps/web/src/app/shared/transactions/klar-transactions-table.component.ts`
- `apps/web/src/app/shared/transactions/klar-transactions-filter-bar.component.ts`
- `apps/web/src/app/shared/transactions/klar-transactions-quick-chips.component.ts`
- `apps/web/src/app/shared/transactions/klar-transactions-row.component.ts`
- `apps/web/src/app/shared/transactions/transaction-filters.ts`
- `apps/web/src/app/shared/transactions/transaction-month-grouping.ts`
- Specs for each helper + component.

**Modified:**

- `apps/web/src/app/core/transactions/transactions.store.ts` — add `query` signal + `loadFiltered()`.
- `apps/web/src/app/pages/buchungen/buchungen.component.ts` — drop tabs/filter logic, render `<klar-transactions-table>`.
- `apps/web/src/app/pages/buchungen/buchungen.component.html` — collapse to header + summary strip + table.
- `apps/web/src/app/pages/buchungen/buchungen.component.css` — remove or shrink to summary-strip-only.
- `apps/web/src/app/pages/banken/banken-account-detail.component.ts` — drop ad-hoc HTTP call, drop local filter logic, drop monthly grouping inline, render `<klar-transactions-table>`.
- `apps/web/src/app/pages/buchungen/transaction-dialog.component.ts` — accept optional `prefill: { accountId? }` input.
- `apps/api/src/transactions/transactions.controller.ts` — only if needed: ensure `?accountId=` + `?month=` combine.
- `apps/api/src/transactions/transactions.repository.ts` — only if needed: AND both clauses in the where filter.

**Deleted:**

- Tab-based filter HTML in `buchungen.component.html`.
- Inline monthly-group rendering in `banken-account-detail.component.ts`.
- Local `transactions` signal + `loadTransactions()` in `banken-account-detail.component.ts`.

## Test plan

### Unit / Component (Vitest, ≥ 70 % lines)

- `transaction-filters.spec.ts` — every filter dimension in isolation, combined, search case-fold, empty filters identity.
- `transaction-month-grouping.spec.ts` — sort order, group keys, per-month sum sign, empty input.
- `klar-transactions-filter-bar.spec.ts` — every control updates state, locked filters render as non-removable, reset clears only user-controllable diff.
- `klar-transactions-quick-chips.spec.ts` — chip toggle on / off, multi-chip combination.
- `klar-transactions-table.spec.ts` — `lockedFilters` merged, not resettable; `isFiltered` derived correctly; `rowClick` emits the expected transaction.
- `buchungen.component.spec.ts` — header + summary strip render, table receives `store.sortedItems()`, edit dialog opens on `(rowClick)`. Update from existing.
- `banken-account-detail.component.spec.ts` — hero metrics read from store, locked account filter, sync triggers `store.reload()`, add button passes `accountId` prefill. Update from existing.

### Backend (only if controller change needed)

- Service unit: `findMany({ accountId, month })` builds the correct `where` clause.
- Repo integration (real DB, transaction rollback): `?accountId=...&month=2026-05` returns only matching rows.

### Playwright smoke (mandatory per Marco)

- `buchungen.spec.ts`:
  - Open `/app/buchungen`, click chip "Wiederkehrend" → list filters, badge count matches; click again → list full.
  - Type in search → list filters live; click reset → search clears.
  - Click a row → edit dialog opens with the right transaction.
  - Click "+ Buchung" → create dialog opens with no `accountId` prefilled.
- `banken-account-detail.spec.ts`:
  - Open `/app/banken/:c/:a`, account pill is locked (no X icon).
  - Search input filters within account.
  - Click sync → spinner → list refreshes.
  - Click "+ Buchung" → create dialog opens with `accountId` prefilled.
  - Click a FinTS row → edit dialog opens with bank fields disabled.

## Migration plan

Four commits, each green and shippable on its own.

### Commit 1: extract pure helpers

- Add `transaction-filters.ts` + `transaction-month-grouping.ts` with full unit tests.
- No consumers yet. Both pages untouched.
- DoD: tests green, lint green, both pages still work as before.

### Commit 2: build `<klar-transactions-table>` + sub-components

- Container + filter bar + quick chips + row.
- Component-level Vitest specs (filter bar interactions, locked-filter merge, quick-chip toggle, row presentation).
- Storybook entry optional (skip if not in repo).
- Not yet wired into pages.
- DoD: tests green, no behavior change in either page.

### Commit 3: `TransactionsStore.loadFiltered()` + backend smoke

- Add `query` signal + `loadFiltered()` to the store.
- Verify backend handles `?accountId=` + `?month=` combination; extend if needed (Service + Repo + Supertest).
- Existing store consumers untouched (they keep using the existing month-driver API).
- DoD: tests green, no behavior change.

### Commit 4: migrate both pages

- `BuchungenPageComponent` → uses `<klar-transactions-table>`. Drop tabs, drop `FILTER_PREDICATES`, drop `filtered/filterCounts` computeds.
- `BankenAccountDetailComponent` → uses `<klar-transactions-table>`. Drop ad-hoc `HttpClient`, drop local `transactions` signal, drop inline monthly grouping, drop the inline filter bar.
- `TransactionDialogComponent` → accept optional `prefill` input, prefill `accountId` if given.
- Update `buchungen.component.spec.ts` + `banken-account-detail.component.spec.ts` (no skips, no deletions of unrelated assertions — only the ones that test removed behavior).
- Run Playwright smokes.
- DoD: full test suite green, lint green, both routes work end-to-end on desktop and mobile (≤ 375 px).

## Definition of Done

1. All four commits land on `main` (per CLAUDE.md: direct on main, one module per commit).
2. `pnpm test` green, `pnpm lint` green, `pnpm build` green before each commit.
3. Frontend coverage ≥ 70 % lines.
4. Playwright smokes pass for both routes.
5. README updated: feature table + detail section explaining the consolidated transactions table.
6. Mobile viewport (≤ 375 px) verified manually for both routes.
7. No `as any`, no `TODO/FIXME/stub`, no `console.log`, no skipped tests.

## Risks / Open questions

- **Account-scoped data volume:** Loading "all transactions for an account, no month limit" can grow large. Monitor — if a single account exceeds ~1 000 transactions, switch the account view to `klar-virtual-list` (already used in admin tabs per memory `project_admin_mcp_audit_virtual_list`).
- **Backend `?month=` support:** Unverified at design time. If absent, commit 3 grows by one repo + service + supertest change. Doesn't affect commit ordering.
- **`prefill` in TransactionDialogComponent:** Need to confirm the dialog already shows an account selector. If not, add one (small).
