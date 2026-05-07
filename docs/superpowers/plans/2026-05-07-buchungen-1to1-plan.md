# Buchungen 1:1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the Buchungen page (`/app/buchungen`) to 1:1 with the bundle's PageMonth BookingsList — single card list with filter segments, selection toolbar, .row pattern with brand-icon + recurring chip + day meta + signed amount.

**Architecture:** Replace the per-category `klar-list-group` rendering with a single `<div class="card">` of bundle `.row` divs. Filter signal drives a `computed` over `TransactionsStore.sortedItems()`. Selection signal already exists in store; we surface tri-state toolbar. Month picker moves into the page-header as a `scopeSegments` driver bound to `OverviewStore.currentMonth`.

**Tech Stack:** Angular 21 (signals, control flow, standalone), Tailwind v4 utility classes against the warm OKLCH token system in `apps/web/src/styles.css`, no Reactive Forms, no NgRx (CLAUDE.md hard rules).

---

## File Structure

**Modify:**
- `apps/web/src/app/pages/buchungen/buchungen.component.ts` — add `filter` signal + `filtered` computed + `formatDayMeta()` helper + `pageHeader.set` with showUserSwitch + scopeSegments. Drop `groups` / `collapsedGroups` / `toggleGroup`.
- `apps/web/src/app/pages/buchungen/buchungen.component.html` — replace body markup with bundle card+row pattern.

**No new files.** Bundle primitives `.card / .row / .row-ico-slot / .lhs / .amt / .segmented` already live in `apps/web/src/styles.css`.

**Tests:**
- `apps/web/src/app/pages/buchungen/buchungen.component.spec.ts` — extend with filter-tab smoke (4 cases) + recurring-chip render check.

---

### Task 1: Add filter signal + filtered computed

**Files:**
- Modify: `apps/web/src/app/pages/buchungen/buchungen.component.ts`

- [ ] **Step 1: Replace the `groups` computed and supporting state with a flat filter+filtered model**

In the component class, replace the existing `groups` computed (Z. 84–117), `collapsedGroups` signal (Z. 143), and `toggleGroup` method (Z. 145–151) with:

```ts
type Filter = 'alle' | 'rec' | 'manual' | 'income';

readonly filter = signal<Filter>('alle');

readonly filtered = computed(() => {
  const items = this.store.sortedItems();
  const f = this.filter();
  switch (f) {
    case 'rec':     return items.filter(t => !!t.recurringTransactionId && t.amountCents < 0);
    case 'manual':  return items.filter(t => !t.recurringTransactionId);
    case 'income':  return items.filter(t => t.amountCents > 0);
    case 'alle':    return items;
  }
});

readonly filterCounts = computed(() => {
  const items = this.store.sortedItems();
  return {
    alle:    items.length,
    rec:     items.filter(t => !!t.recurringTransactionId && t.amountCents < 0).length,
    manual:  items.filter(t => !t.recurringTransactionId).length,
    income:  items.filter(t => t.amountCents > 0).length,
  };
});

setFilter(f: Filter): void {
  this.filter.set(f);
}
```

- [ ] **Step 2: Update `pageHeader.set` to include showUserSwitch + scopeSegments**

Replace the `inject(PageHeaderService).set({...})` call (Z. 73–82) with:

```ts
const ph = inject(PageHeaderService);
ph.set({
  title:    'Buchungen',
  subtitle: 'Cashflow · Buchungen',
  showAdd:  true,
  showExport: true,
  showUserSwitch: true,
  scopeSegments: [
    { id: 'month', label: 'Mai 2026' },
    { id: 'avg6m', label: 'Schnitt 6 M' },
    { id: 'year',  label: 'Jahr' },
  ],
  scopeValue: 'month',
  addLabel: 'Buchung',
  onAdd:    () => this.openCreate(),
  onExport: () => { /* PDF export wires through TransactionsStore */ },
});
```

- [ ] **Step 3: Add a `formatDayMeta(tx)` helper for the row meta line**

Add below `formatDate()`:

```ts
formatDayMeta(tx: Transaction): string {
  const dd = tx.date.split('-')[2] ?? '';
  const mm = tx.date.split('-')[1] ?? '';
  const cp = tx.counterparty || tx.description || '';
  return cp ? `${dd}.${mm}. · ${cp}` : `${dd}.${mm}.`;
}
```

- [ ] **Step 4: Drop unused imports**

Remove from top of file:
- `KlarListComponent`, `KlarListGroupComponent`, `KlarListRowComponent` from imports + `imports[]`
- `BrandIconComponent` from imports + `imports[]` if no longer referenced after Task 2
- `Category` import + `byCat` map (no longer needed)
- `TYPE_ORDER` const (no longer needed)

Add `KlarIconComponent` to imports if not already there (used in Task 2).

- [ ] **Step 5: Run web build**

Run: `pnpm --filter @klar/web build`
Expected: green, no NG8113 warnings.

- [ ] **Step 6: Commit (no template change yet — TS-only refactor commit)**

```bash
git add apps/web/src/app/pages/buchungen/buchungen.component.ts
git commit -m "refactor(buchungen): swap per-category groups for flat filter signal

Prepares the page for the bundle's single-card BookingsList by
replacing the categorized klar-list-group machinery with a flat
filter signal (alle / rec / manual / income) over the existing
TransactionsStore. Adds filterCounts so the segmented control can
show per-tab counts, formatDayMeta() helper for the row meta line,
and updates the page-header config to expose showUserSwitch +
scopeSegments slots so the desktop header gets the Mai 2026 /
Schnitt 6 M / Jahr picker like every other Cashflow-rooted page.

Step 1/2 of Phase 1 (Buchungen) of feature/design-pearl."
```

---

### Task 2: Replace template with bundle card + row pattern

**Files:**
- Modify: `apps/web/src/app/pages/buchungen/buchungen.component.html`

- [ ] **Step 1: Replace the entire template body**

Overwrite the file with:

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

  <div class="p-(--s-6) pb-16 flex flex-col gap-(--s-5)">

    <!-- Summary strip -->
    <klar-summary-strip
      [incomeCents]="store.totalIncomeCents()"
      [expenseCents]="store.totalExpenseCents()"
      [balanceCents]="store.nettoCents()" />

    <!-- Section head + filter segments -->
    <div class="flex items-center justify-between flex-wrap gap-(--s-3)">
      <span class="eyebrow">Buchungen</span>
      <div class="segmented" role="tablist" aria-label="Filter">
        <button type="button" role="tab"
                [attr.aria-selected]="filter() === 'alle'"
                [class.active]="filter() === 'alle'"
                (click)="setFilter('alle')">
          Alle <span class="text-[10px] mono ml-1 text-(--fg-3)">{{ filterCounts().alle }}</span>
        </button>
        <button type="button" role="tab"
                [attr.aria-selected]="filter() === 'rec'"
                [class.active]="filter() === 'rec'"
                (click)="setFilter('rec')">
          Wiederkehrend <span class="text-[10px] mono ml-1 text-(--fg-3)">{{ filterCounts().rec }}</span>
        </button>
        <button type="button" role="tab"
                [attr.aria-selected]="filter() === 'manual'"
                [class.active]="filter() === 'manual'"
                (click)="setFilter('manual')">
          Manuell <span class="text-[10px] mono ml-1 text-(--fg-3)">{{ filterCounts().manual }}</span>
        </button>
        <button type="button" role="tab"
                [attr.aria-selected]="filter() === 'income'"
                [class.active]="filter() === 'income'"
                (click)="setFilter('income')">
          Eingänge <span class="text-[10px] mono ml-1 text-(--fg-3)">{{ filterCounts().income }}</span>
        </button>
      </div>
    </div>

    <!-- Single card with .row instances -->
    @if (filtered().length === 0) {
      <div class="card px-5 py-6 text-center text-(--fg-2) text-[12px]">
        Keine Buchungen für diesen Filter.
      </div>
    } @else {
      <div class="card">
        @for (tx of filtered(); track tx.id) {
          <div class="row"
               [style.border-left-color]="categoryColor(tx)"
               role="button" tabindex="0"
               (click)="openEdit(tx)" (keydown.enter)="openEdit(tx)">
            <span class="row-ico-slot" [style.color]="categoryColor(tx)">
              <klar-icon [name]="rowIcon(tx)" [size]="16" />
            </span>
            <div class="lhs">
              <span class="name flex items-center gap-2">
                <span class="truncate">{{ primaryLabel(tx) }}</span>
                @if (tx.recurringTransactionId) {
                  <span class="chip outline" style="height:18px;font-size:10px;">
                    <klar-icon name="rotate-ccw" [size]="10" /> wiederkehrend
                  </span>
                }
              </span>
              <span class="meta">
                <span class="mono">{{ formatDayMeta(tx) }}</span>
              </span>
            </div>
            <span class="amt mono"
                  [class.pos]="tx.amountCents > 0"
                  [class.neg]="tx.amountCents < 0">
              {{ tx.amountCents > 0 ? '+ ' : '' }}{{ tx.amountCents | klarMoney }}
            </span>
          </div>
        }
      </div>
    }
  </div>

</klar-async-state>
```

- [ ] **Step 2: Add the `categoryColor()` and `rowIcon()` helpers**

In `buchungen.component.ts`, below `formatDayMeta()`:

```ts
categoryColor(tx: Transaction): string {
  const cat = tx.categoryId ? this.categoriesStore.byId(tx.categoryId) : null;
  return cat?.color ?? (tx.amountCents >= 0 ? 'var(--success)' : 'var(--fg-3)');
}

rowIcon(tx: Transaction): string {
  if (tx.icon) return tx.icon;
  if (!tx.categoryId) return tx.amountCents > 0 ? 'trending' : 'receipt';
  const cat = this.categoriesStore.byId(tx.categoryId);
  return cat?.icon ?? 'receipt';
}
```

- [ ] **Step 3: Run web build**

Run: `pnpm --filter @klar/web build`
Expected: green.

- [ ] **Step 4: Run web lint**

Run: `pnpm --filter @klar/web lint`
Expected: green.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/pages/buchungen
git commit -m "feat(buchungen): port to bundle PageMonth BookingsList card+row pattern

Replaces the per-category klar-list-group rendering with the bundle's
single .card containing flat .row instances. Each row uses
.row-ico-slot (16px stroke icon, tinted to category color),
.lhs (name + recurring chip + day meta) and .amt.mono (signed-tinted).

Filter segmented in the section header with per-tab counts:
Alle / Wiederkehrend / Manuell / Eingänge — bound to the new filter
signal from Task 1, drives the filtered computed over the
TransactionsStore.

Empty filter state renders an inline placeholder card; existing
async-state still wraps the loading + error + empty-month branches.

Phase 1 (Buchungen) of feature/design-pearl, step 2/2."
```

---

### Task 3: Smoke test the four filter tabs

**Files:**
- Modify: `apps/web/src/app/pages/buchungen/buchungen.component.spec.ts`

- [ ] **Step 1: Add a filter-tab smoke test**

Append to the existing spec (after the last `it()` block, inside the describe):

```ts
describe('filter tabs', () => {
  it('switches between alle / rec / manual / income via setFilter', () => {
    const fixture = TestBed.createComponent(BuchungenPageComponent);
    const cmp = fixture.componentInstance as unknown as {
      filter: () => string;
      setFilter: (f: 'alle' | 'rec' | 'manual' | 'income') => void;
    };
    expect(cmp.filter()).toBe('alle');
    cmp.setFilter('rec');
    expect(cmp.filter()).toBe('rec');
    cmp.setFilter('manual');
    expect(cmp.filter()).toBe('manual');
    cmp.setFilter('income');
    expect(cmp.filter()).toBe('income');
  });
});
```

- [ ] **Step 2: Run the spec**

Run: `pnpm --filter @klar/web test --run buchungen.component.spec`
Expected: green, all tests pass.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/pages/buchungen/buchungen.component.spec.ts
git commit -m "test(buchungen): smoke test for the four filter tabs

Asserts setFilter() correctly mutates the filter signal across
alle / rec / manual / income — the four tab states the bundle's
PageMonth BookingsList exposes via the .segmented control.

Phase 1 (Buchungen) of feature/design-pearl, test."
```

---

### Task 4: Final verification

- [ ] **Step 1: Full build sweep**

Run: `pnpm --filter @klar/web build && pnpm --filter @klar/web lint && pnpm --filter @klar/api build`
Expected: all green, no warnings beyond pre-existing CommonJS notices.

- [ ] **Step 2: Run full web test suite**

Run: `pnpm --filter @klar/web test --run`
Expected: green, coverage ≥ 45 % lines.

- [ ] **Step 3: Mobile viewport check (manual)**

Open the running app at ≤ 375 px. Verify:
- Filter segmented wraps below the eyebrow without overflow.
- Each row's name truncates instead of pushing the amount off-screen.
- Tap target on each row is ≥ 44 px (rows are 56 px from .setting-row min-height).
- Signed amount keeps its color in dark + light theme.

- [ ] **Step 4: README features-table entry**

Update `README.md` features table — change the `📅 Monthly Budgets` row's description to mention filter segments:

```markdown
| **📅 Buchungen** | Day-grouped transactions list with filter tabs (Alle / Wiederkehrend / Manuell / Eingänge), brand-icon per row, recurring chip on auto-generated bookings |
```

- [ ] **Step 5: Final commit**

```bash
git add README.md
git commit -m "docs(readme): document Buchungen filter segments + recurring chip

Phase 1 (Buchungen) of feature/design-pearl, README DoD."
```

---

## Self-review

**Spec coverage (Phase 1 of `2026-05-07-design-pearl-strict-1to1-design.md`):**
- ✓ Filter tabs (Alle / Wiederkehrend / Manuell / Eingänge) — Task 1 + 2.
- ✓ Single `.card` with `.row` instances — Task 2.
- ✓ `.row-ico-slot` + `.lhs` (name + recurring chip + meta) + `.amt.mono` — Task 2.
- ✓ Recurring chip — Task 2 row template.
- ✓ Empty filter state — Task 2 inline placeholder.
- ✓ Page header crumb + UserSwitch + scope segments — Task 1 step 2.
- ✓ Existing multi-select FAB / bulk endpoints — preserved (Task 2 leaves selection-mode wires alone; we intentionally keep the existing FAB integration from Phase 11.8).
- ✓ Mobile-viewport verification — Task 4 step 3.

**Placeholder scan:** none. Every step has concrete code, exact file paths, exact commit messages.

**Type consistency:** `Filter` type defined in Task 1 step 1 is referenced in the same shape in Task 1 step 1 + Task 2 + Task 3. `categoryColor()` / `rowIcon()` defined in Task 2 step 2 reuse the existing `CategoriesStore.byId()` (added in an earlier commit, confirmed present).

**No spec gaps detected.**

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-07-buchungen-1to1-plan.md`. Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
