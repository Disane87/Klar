# Projekte 1:1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring `/app/projekte` (PageProjects grid) and `/app/projekte/:id` (PageProjectDetail) to 1:1 with the bundle.

**Architecture:** Replace the existing custom `.meter` linear bar with `klar-progress-ring`. Detail page uses 3-up `klar-metric-tile` hero strip + per-category mini-bars + scoped `.card + .row` tx list + sticky footer actions. Page-header crumb + filter segments + Add action.

**Tech Stack:** Angular 21 zoneless signals, Tailwind v4 utility classes against `apps/web/src/styles.css` design tokens.

---

## File Structure

**Modify:**
- `apps/web/src/app/pages/projekte/projekte.component.html` — swap `.meter` for `<klar-progress-ring>`, restructure tile to bundle hero-number-on-top layout.
- `apps/web/src/app/pages/projekte/projekte.component.ts` — add `KlarProgressRingComponent` to imports + page-header crumb config.
- `apps/web/src/app/pages/projekte/project-detail.component.html` — restructure: 3-up `klar-metric-tile` row, per-category mini-bars, `.card + .row` tx list, sticky footer.
- `apps/web/src/app/pages/projekte/project-detail.component.ts` — imports + page-header config.
- `apps/web/src/app/pages/projekte/projekte.component.css` — remove `.meter`-specific overrides (now using primitive), tighten tile layout.
- `apps/web/src/app/pages/projekte/project-detail.component.css` — drop legacy meter / number-grid styles superseded by klar-metric-tile.

**No new files.** All primitives (`klar-progress-ring`, `klar-metric-tile`, `.card`, `.row`, `.row.subtotal`) live in `apps/web/src/app/shared/ui/` + `styles.css`.

---

### Task 1: Projekte grid — swap meter for klar-progress-ring + page-header crumb

**Files:**
- Modify: `apps/web/src/app/pages/projekte/projekte.component.ts`
- Modify: `apps/web/src/app/pages/projekte/projekte.component.html`

- [ ] **Step 1: Add KlarProgressRingComponent + crumb subtitle**

In `projekte.component.ts`:
- Import `KlarProgressRingComponent` from `'../../shared/ui/klar-progress-ring.component'` and add to `imports[]`.
- In the constructor or `ngOnInit`, ensure `pageHeader.set` includes `subtitle: 'Haushalt · alle aktiv'` (or current filter label) and crumb-style title `'Projekte'`. If a `subtitle` field doesn't exist on the existing call, add it.

- [ ] **Step 2: Replace meter bar with progress-ring in tile markup**

In `projekte.component.html`, find the existing `<div class="meter">` block (around line 89) and replace with:

```html
@if (item.totalBudgetCents !== null) {
  <div class="flex items-center justify-between gap-(--s-3) mt-(--s-2)">
    <klar-progress-ring
      [value]="progressPercent(item) / 100"
      [tone]="item.color"
      [size]="36"
      [showValue]="true"
      [ariaLabel]="item.name + ' Fortschritt'"
    />
    <span class="text-[11px] mono text-(--fg-2)">
      {{ progressPercent(item) }}&nbsp;%
    </span>
  </div>
}
```

Remove the now-unused `.meter` div but **keep** the existing 3-column `.pc-numbers` grid (Budget / Ausgegeben / Bilanz) and the `.pc-footnote` block — those already match the bundle pattern.

- [ ] **Step 3: Build + lint**

```
pnpm --filter @klar/web build
pnpm --filter @klar/web lint
```

Both exit 0.

- [ ] **Step 4: Commit**

```
git add apps/web/src/app/pages/projekte/projekte.component.ts apps/web/src/app/pages/projekte/projekte.component.html
git commit -m "feat(projekte): swap meter bar for klar-progress-ring in tile

The bundle's PageProjects renders project progress as a circular ring
in the project's tone, not a linear bar. Replaces the custom .meter
markup with the existing klar-progress-ring primitive (36 px, value
0..1, tone driven by project.color, percent label inside the ring).

Page header gains the bundle's 'Haushalt · alle aktiv' crumb subtitle
so the page-header service renders the eyebrow + Fraunces title pair.

Phase 2 (Projekte) of feature/design-pearl, step 1/3."
```

---

### Task 2: Project detail page — hero strip + tx list

**Files:**
- Modify: `apps/web/src/app/pages/projekte/project-detail.component.ts`
- Modify: `apps/web/src/app/pages/projekte/project-detail.component.html`

- [ ] **Step 1: Add KlarMetricTileComponent + page-header config**

In `project-detail.component.ts`:
- Import `KlarMetricTileComponent` from `'../../shared/ui/klar-metric-tile.component'` + add to `imports[]`.
- Update page-header config: `title: project.name` (computed from store), `subtitle: 'Projekte · Detail'`, `showAdd: false` for now (the add action lives inside the detail page footer).
- Make sure `KlarIconComponent` is imported for status chip + footer actions.

- [ ] **Step 2: Replace top-of-page metric block with 3-up klar-metric-tile row**

In `project-detail.component.html`, find the existing budget/spent/balance numeric block (typically near the top, look for class names like `.detail-numbers`, `.metric-row`, or similar). Replace it with:

```html
@if (project(); as p) {
  <div class="grid grid-cols-1 md:grid-cols-3 gap-(--s-3)">
    <klar-metric-tile
      label="Budget"
      [value]="(p.totalBudgetCents !== null ? (p.totalBudgetCents | klarMoney) : '—') ?? '—'"
    />
    <klar-metric-tile
      label="Ausgegeben"
      [value]="(p.spentCents | klarMoney) ?? '—'"
    />
    <klar-metric-tile
      label="Bilanz"
      [value]="(p.balanceCents | klarMoney) ?? '—'"
      [accent]="p.balanceCents >= 0"
    />
  </div>
}
```

(`?? '—'` falls back when the pipe returns null.)

- [ ] **Step 3: Replace transactions list with .card + .row pattern**

Find the existing tx-list in the detail page (look for `<klar-list>`, `<klar-list-row>`, or a div loop iterating `project.transactions`). Replace with the bundle pattern:

```html
@if (transactions().length > 0) {
  <div class="card mt-(--s-5)">
    @for (tx of transactions(); track tx.id) {
      <div class="row"
           [style.border-left-color]="categoryColor(tx)"
           role="button" tabindex="0"
           (click)="openTx(tx)"
           (keydown.enter)="openTx(tx)"
           (keydown.space)="$event.preventDefault(); openTx(tx)">
        <span class="row-ico-slot" [style.color]="categoryColor(tx)">
          <klar-icon [name]="rowIcon(tx)" [size]="16" />
        </span>
        <div class="lhs">
          <span class="name">{{ tx.description || '—' }}</span>
          <span class="meta">
            <span class="mono">{{ formatTxDay(tx) }}</span>
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
} @else {
  <div class="card px-5 py-6 text-center text-(--fg-2) text-[13px] mt-(--s-5)">
    Noch keine Buchungen für dieses Projekt.
  </div>
}
```

Add helpers `categoryColor(tx)`, `rowIcon(tx)`, `formatTxDay(tx)`, `openTx(tx)` if not already present (mirror the Buchungen page implementations).

- [ ] **Step 4: Sticky footer actions**

Below the tx list, add a sticky footer matching the bundle:

```html
<div class="fixed bottom-0 left-0 right-0 md:sticky md:bottom-auto bg-(--bg-1) border-t border-(--line) px-(--s-5) py-(--s-3) flex justify-between items-center gap-(--s-3) z-10">
  <button type="button" class="btn ghost" (click)="goBack()">
    <klar-icon name="chevron-left" [size]="14" /> Zurück
  </button>
  <div class="flex gap-(--s-2)">
    <button type="button" class="btn warn" (click)="archive()">Archivieren</button>
    <button type="button" class="btn primary" (click)="openEdit()">Bearbeiten</button>
  </div>
</div>
```

If `archive()` / `goBack()` / `openEdit()` are not yet implemented in the .ts, stub them to call existing flows (the existing page already has edit + delete dialogs — wire the buttons through to them).

- [ ] **Step 5: Build + lint**

```
pnpm --filter @klar/web build
pnpm --filter @klar/web lint
```

Both exit 0.

- [ ] **Step 6: Commit**

```
git add apps/web/src/app/pages/projekte/project-detail.component.ts apps/web/src/app/pages/projekte/project-detail.component.html
git commit -m "feat(projekte): port project-detail to bundle hero + .card+.row pattern

Hero strip is now a 3-up klar-metric-tile row (Budget / Ausgegeben /
Bilanz). The bilanz tile lights with --success accent when positive.
Transactions list replaces the legacy klar-list with a single .card
containing flat .row instances, .row-ico-slot tinted to the category
color, .lhs (name + day-meta), .amt.mono signed-tinted — same DRY
primitive set used by Buchungen.

Sticky footer actions: Zurück (ghost) on the left, Archivieren (warn)
+ Bearbeiten (primary) on the right. Mobile pins the footer to the
viewport bottom; desktop sticks at the page-body bottom.

Empty-state inline placeholder card replaces the previous chrome-y
empty block.

Phase 2 (Projekte) of feature/design-pearl, step 2/3."
```

---

### Task 3: README + CSS cleanup

**Files:**
- Modify: `apps/web/src/app/pages/projekte/projekte.component.css` (drop dead .meter rules)
- Modify: `apps/web/src/app/pages/projekte/project-detail.component.css` (drop dead detail-meter / number-grid rules superseded by klar-metric-tile)
- Modify: `README.md` (Project Tracking row gets klar-progress-ring mention)

- [ ] **Step 1: Drop the dead CSS**

Search both CSS files for class names that are no longer referenced in their respective HTML (after Tasks 1+2). Common candidates: `.meter`, `.meter-bar`, `.detail-numbers`, `.metric-row`, custom progress-bar tokens. Use `git grep` from the page directory to confirm before removing.

- [ ] **Step 2: README row update**

In `README.md`, find the `🎯 Project Tracking` row and replace its description with:

```
| **🎯 Projekte** | Tile grid with circular klar-progress-ring per project tinted in project color, 3-up Budget / Ausgegeben / Bilanz metric-tiles on detail page, scoped transactions list, archive / edit sticky footer |
```

- [ ] **Step 3: Build + lint + test**

```
pnpm --filter @klar/web build
pnpm --filter @klar/web lint
pnpm --filter @klar/web test --run
```

All exit 0 (tests pass; coverage ≥ 45%).

- [ ] **Step 4: Final commit**

```
git add apps/web/src/app/pages/projekte README.md
git commit -m "feat(projekte): drop legacy meter CSS + README update

CSS cleanup after Tasks 1+2: removes the now-unused .meter, .detail-
numbers, and .metric-row rules (superseded by klar-progress-ring +
klar-metric-tile primitives). README features row reflects the new
hero-strip + ring + sticky-footer layout.

Phase 2 (Projekte) of feature/design-pearl, step 3/3."
```

---

## Self-review

- ✓ Spec coverage: PageProjects ring + tile + chip + grid; PageProjectDetail metric-tiles + scoped tx list + sticky footer; both share global primitives.
- ✓ DRY: klar-progress-ring + klar-metric-tile reused, no per-page reimplementation. `categoryColor` / `rowIcon` / `formatTxDay` mirror Buchungen helpers (next page that reuses them — Cashflow / Calendar — gets them already).
- ✓ TDD-ish: existing component specs continue to pass (no logic change). Coverage maintained ≥ 45%.
- ✓ A11y: row uses keyboard activation triple (enter / space + preventDefault).
- ✓ No placeholders, no TBD.
