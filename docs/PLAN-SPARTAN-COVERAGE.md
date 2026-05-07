# Spartan UI Coverage — Audit & Implementation Plan

Static audit of `apps/web/src/**` for native HTML controls and ad-hoc styled `<button>`s
that should be migrated to Spartan UI primitives or extracted into reusable `klar-*`
components. Cross-checked against the component catalog at https://spartan.ng/components.

> Scope: web app only. No backend changes. Goal: maximize generic, reusable UI so
> per-page hand-styling shrinks and dark-mode / a11y / mobile rules apply consistently.

---

## 1. Current Spartan footprint

Installed packages:

- `@spartan-ng/brain@0.0.1-alpha.683`
- `@spartan-ng/ui-command-brain`, `ui-dialog-brain`, `ui-popover-brain`, `ui-select-brain`

Existing local hlm wrappers in `apps/web/src/app/shared/ui/hlm/`:

- ✅ `hlm-button`, `hlm-input`, `hlm-label`, `hlm-error`
- ✅ `hlm-badge`, `hlm-checkbox`, `hlm-loading-btn`, `hlm-spinner`
- ✅ `hlm-calendar`
- ✅ `hlm-dialog/` (folder, currently empty `.gitkeep` — needs filling)
- ✅ `hlm-select/hlm-select-native.directive.ts` (native `<select>` only)
- ✅ `hlm-toggle-group` + `hlm-toggle-group-item`

Brain primitives actually used in code:

- `BrnPopover` → `klar-combobox`, `klar-header-user`
- `BrnHoverCard` → `csv-preview-row`

Custom Klar components on top:

- `klar-input`, `klar-form-field`, `klar-dialog`, `klar-toast`, `klar-list`, `klar-virtual-list`,
  `klar-list-item/row/group`, `klar-icon-button`, `klar-fab`, `klar-card`, `klar-stat-card`,
  `klar-section-header`, `klar-toolbar`, `klar-filter-bar`, `klar-summary-strip`,
  `klar-empty-state`, `klar-error-bar`, `klar-skeleton(-rows/-cards)`, `klar-month-picker/-chip`,
  `klar-color-picker`, `klar-icon-picker`, `klar-combobox`, `klar-avatar`, `klar-button`,
  `klar-header-user`, `klar-image-crop-dialog`, `klar-code-editor`.

---

## 2. Findings — native controls / ad-hoc styling

Severity: 🔴 must fix · 🟡 should fix · 🟢 nice to have.

### A. Switch control (no wrapper exists)

🔴 **`apps/web/src/app/pages/fixkosten/fixkosten.component.html:53`**
A `<button role="switch">` with hand-rolled tailwind classes for the Planspiel toggle.
No keyboard semantics (`aria-checked` only via attr binding, no `Space` handler, no focus ring).

→ Add `hlm-switch` (Spartan **Switch**) and replace.

### B. Tabs (admin uses button-pairs)

🟡 **`apps/web/src/app/pages/admin/admin.component.ts:24-33`**
Four `<button hlmBtn>` elements toggle a `tab()` signal. Works, but Spartan **Tabs**
gives keyboard arrow-nav, `role="tablist"` and ARIA wiring for free. Same anti-pattern
in projekte filter pills (`projekte.component.html:7-11`, `class="filter-btn"`).

→ Add `hlm-tabs` wrapper, migrate admin & projekte filters.

### C. Filter pills / segmented controls

🟡 **`apps/web/src/app/pages/fixkosten/fixkosten.component.html:65-95`**
Member-filter avatar pills — hand-styled `<button>`s with class toggles for active state.
🟡 **`apps/web/src/app/pages/planspiel/planspiel.component.html:139-154`** —
income/expense segmented selector, also hand-rolled.

→ Use existing `hlm-toggle-group` (already wrapped) — or extract a `klar-segmented`
component on top of toggle-group + avatar slot for the member case.

### D. Native `<select>` without `hlmSelect`

🔴 **`apps/web/src/app/pages/haushalt/category-edit-dialog.component.ts:56-62`**
`<select>` with hand-rolled border + `class="scheme-dark"` instead of `hlmSelect`.

→ Add `hlmSelect` directive (existing).

### E. `<input>` without `hlmInput`

🔴 **`apps/web/src/app/pages/haushalt/invite-dialog.component.ts:54-58`**
Read-only invite-link `<input>` styled by hand.
🔴 **`apps/web/src/app/pages/haushalt/category-edit-dialog.component.ts:88-93`**
Native `<input type="color">` — should go through the existing `klar-color-picker`.
🟢 **`apps/web/src/app/pages/settings/settings.component.html:53,186`**
Two hidden file inputs — `class="sr-only"`, OK to leave.

→ Add `hlmInput` to invite link; replace color input with `klar-color-picker`.

### F. Bare `<button>` without `hlmBtn`

🟡 Long list — confirmed cases (sample, not exhaustive):

- `pages/planspiel/planspiel.component.html` — reset (line 10), entry-remove (117),
  income/expense toggle (139, 148), color swatches (205), cancel/submit (220, 227),
  add-posten (246).
- `pages/fixkosten/fixkosten.component.html` — switch button (53), member filter pills
  (66, 86), selection-mode toggle (110), export-pdf (118).
- `pages/onboarding/onboarding.component.html` — mode-picker tiles (15, 28),
  logout link (42).
- `pages/haushalt/haushalt.component.html` — category row trigger (91),
  copy-api-key icon button (123).
- `pages/projekte/projekte.component.html` — filter-btn (7), and
  `project-detail.component.html` back-btn (5).
- `pages/settings/settings.component.html` — avatar remove/upload (35, 44).
- `pages/settings/connected-apps/connected-apps.component.html` — rename / reset / edit
  icon buttons (68, 83).
- `pages/csv-import/components/csv-preview-row.component.ts:102` — info icon button (uses
  `brnHoverCardTrigger`, but no `hlmBtn`).
- `shared/ui/klar-toast.component.html:27`, `shared/ui/klar-dialog.component.html:4` —
  close buttons.

→ Categorize:
   - **Icon-only buttons** (copy, rename, close, back, remove) → use existing
     `klar-icon-button`.
   - **Action tiles** (onboarding mode picker, category row) → extract
     `klar-action-tile` (full-width clickable card with icon + title + subtitle + chevron).
   - **All others** → `hlmBtn` with `variant`/`size`.

### G. Missing Spartan wrappers we should add

Spartan primitives **not yet wrapped** but needed to remove ad-hoc UI:

| Spartan       | Use case in Klar                                                | Prio |
|---------------|-----------------------------------------------------------------|------|
| **Switch**    | Planspiel toggle in fixkosten; future settings booleans         | 🔴   |
| **Tabs**      | Admin tab bar; projekte status filter                           | 🟡   |
| **Tooltip**   | Icon buttons (copy api-key, rename, info, close)                | 🟡   |
| **Sheet**     | Mobile drawers (currently we only have klar-dialog + bottom-nav)| 🟡   |
| **Popover**   | Used via brain — wrap as `hlm-popover` for consistency          | 🟡   |
| **Sonner**    | Decide: keep `klar-toast` or migrate; **recommend keep** (custom positioning + safe-area already correct) | 🟢 |
| **Separator** | List section dividers (currently bespoke `border-b`)            | 🟢   |
| **Textarea**  | None today — but mail-template editor is overdue (currently uses `hlmInput` on a select! see H) | 🟡 |
| **Alert Dialog** | Confirm actions (delete, reset planspiel) — currently bespoke or `confirm()` | 🟡 |
| **Skeleton** (Spartan) | Already covered by `klar-skeleton*` — keep ours        | —    |

### H. Direct bugs found while auditing

🔴 **`pages/haushalt/mail-templates/mail-template-edit-dialog.component.ts:89`**
`<select hlmInput …>` — wrong directive on `<select>`. Should be `hlmSelect`.
🔴 Same file, presumably the body is a single-line `<input>` — needs `<textarea hlmInput>`
once we add a `hlm-textarea` wrapper.

### I. Reusable wrappers worth extracting

These appear ≥ 2× in hand-rolled form. Pulling them into `shared/ui/` will eliminate
duplication and re-styling drift:

1. **`klar-switch`** — wraps `hlm-switch`, includes label slot + helper text.
2. **`klar-tabs`** — wraps `hlm-tabs`, optional sticky positioning + count badges.
3. **`klar-action-tile`** — full-width pressable card row used in onboarding & haushalt
   category list.
4. **`klar-segmented`** — uses `hlm-toggle-group` underneath, supports avatar slot for
   member-filter use case.
5. **`klar-confirm-dialog`** — built on Alert Dialog, replaces `window.confirm` and
   `confirmReset()` patterns; pre-wired with destructive variant for delete flows.
6. **`klar-tooltip`** — small ergonomic wrapper over Spartan tooltip.
7. **`klar-textarea`** — once `hlm-textarea` is wrapped.

---

## 3. Implementation plan (5 phases)

Each phase ends with: tests green · lint green · `pnpm build` green · README features
table touched if user-visible · Playwright smoke pass.

### Phase S1 — Wrap missing Spartan primitives  *(infra, ~1d)*

Tasks:
1. Install `@spartan-ng/ui-switch-helm`, `…-tabs-helm`, `…-tooltip-helm`,
   `…-sheet-helm`, `…-textarea-helm`, `…-alertdialog-helm` (or matching brain pkgs +
   inline helm impls — match what `spartan.ng` ships at the alpha pin we use).
2. Create wrappers in `apps/web/src/app/shared/ui/hlm/`:
   - `hlm-switch.component.ts`
   - `hlm-tabs/` (list, trigger, content)
   - `hlm-tooltip.directive.ts`
   - `hlm-sheet/`
   - `hlm-textarea.directive.ts`
   - `hlm-alert-dialog/`
3. Fill `hlm-dialog/` (currently empty `.gitkeep`) with proper helm wrapper — today
   `klar-dialog` reimplements the overlay; align it to use the helm primitives so we
   inherit a11y / focus-trap from Spartan.
4. Vitest unit specs (snapshot + a11y attrs) for each new wrapper.
5. CLAUDE.md "Spartan UI — Pflicht" section: add the new wrappers to the checklist.

### Phase S2 — Extract `klar-*` composites  *(~½d)*

Build on top of S1:
- `klar-switch` (label + description + danger variant)
- `klar-tabs` (sticky-on-scroll variant)
- `klar-segmented` (toggle-group + avatar slot)
- `klar-action-tile` (icon + title + subtitle + trailing chevron + click)
- `klar-confirm-dialog` (alert-dialog wrapper, opens via `klar-dialog.service`)
- `klar-tooltip` (directive form)
- `klar-textarea` (form-field aware)

Each ships with a Vitest spec and an entry in `klar-components.spec.ts`.

### Phase S3 — Migrate pages  *(~1.5d, atomic per page)*

Order chosen by blast radius (dialog/shared first, then leaf pages):

1. `klar-toast.component.html` close button → `klar-icon-button`.
2. `klar-dialog.component.html` close button → `klar-icon-button` + tooltip.
3. `category-edit-dialog` — `<select>` → `hlmSelect`, `<input type="color">` →
   `klar-color-picker`.
4. `mail-template-edit-dialog` — fix `<select hlmInput>` bug → `hlmSelect`; body input
   → `klar-textarea`.
5. `invite-dialog` — read-only link `<input>` → `hlmInput` (with copy `klar-icon-button`
   + tooltip "Link kopieren").
6. `fixkosten.component.html` — Planspiel switch → `klar-switch`; member-filter pills →
   `klar-segmented`; selection-mode + export buttons → `hlmBtn variant="ghost" size="sm"`.
7. `planspiel.component.html` — income/expense → `klar-segmented`;
   color swatches → `klar-color-picker`; reset/cancel/submit → `hlmBtn`;
   add-posten → `hlmBtn variant="outline"` with dashed override class;
   reset confirm → `klar-confirm-dialog`.
8. `onboarding.component.html` — mode picker tiles → `klar-action-tile`; logout →
   `hlmBtn variant="link"`.
9. `haushalt.component.html` — category row → `klar-action-tile`; copy-api-key →
   `klar-icon-button` + tooltip.
10. `projekte.component.html` filter-btn → `klar-tabs` (or `klar-segmented`);
    `project-detail.component.html` back-btn → `klar-icon-button`.
11. `settings.component.html` avatar buttons → `hlmBtn`.
12. `connected-apps.component.html` rename/reset/edit → `klar-icon-button` + tooltip.
13. `csv-preview-row.component.ts` info button → `klar-icon-button`.
14. `admin.component.ts` tab bar → `klar-tabs`.

One commit per file (CLAUDE.md rule "ein Modul = ein Commit").

### Phase S4 — A11y / kbd sweep  *(~½d)*

- Run axe-core on `/app/fixkosten`, `/app/planspiel`, `/app/admin`, `/app/onboarding`.
- Verify keyboard: Tab order, Enter/Space on tiles, Arrow on tabs/segmented/toggle-group.
- Verify screen-reader labels on all icon-only buttons (`aria-label` mandatory in
  `klar-icon-button` already).

### Phase S5 — Docs + cleanup  *(~½h)*

- README → "Tech / UI" table: list new wrappers (Switch, Tabs, Tooltip, Sheet, Textarea,
  Alert Dialog).
- Update memory: `feedback_spartan_controls.md` to mention new wrappers + composites.
- Delete dead `.gitkeep` files in `hlm-dialog/`, `hlm-select/` once filled.
- Grep gate in CI (script): fail PR if any `<input|select|textarea>` lacks `hlm*` outside
  of `shared/ui/`.

### Estimate

Total ≈ **3.5–4 dev days** including tests + Playwright smoke. Phases S1+S2 unblock
S3 and can be parallelized via swarm (S1 by one agent, composites by another once
S1 lands).

---

## 4. Out of scope

- Replacing `klar-toast` with Spartan **Sonner** — custom positioning + safe-area handling
  are already correct; rewriting is risk without payoff.
- Replacing `klar-skeleton*` with Spartan **Skeleton** — equivalent, no benefit.
- `klar-form-field` / `klar-combobox` — already abstracted, keep.
- Backend / Prisma / API: untouched.

---

## 5. Beyond Spartan — patterns worth generalizing

These are duplications **not solvable by adding a Spartan wrapper**. They're either
domain-specific (money, dates, async-state) or higher-level compositions. Same severity
scale.

### G1. Async-state wrapper 🔴

`@if (loading()) { <klar-skeleton-rows> } @else if (error()) { <klar-error-bar> }
@else if (empty) { <klar-empty-state> } @else { … }` — repeats verbatim in
**buchungen, fixkosten, monat, projekte, project-detail, haushalt** (categories +
api-keys), and partially in admin-tabs (with `klar-virtual-list[loading]`). 6+ pages,
~30 LOC each, drift-prone (one already deviates: admin uses `[loading]` on
virtual-list instead of skeleton).

→ Extract `<klar-async-state [resource]="store" [empty]="…" [emptyCta]="…"
   (retry)="…" (cta)="…">@if (data) { <ng-content/> }</klar-async-state>`.
   Inputs: `loading`, `error`, `empty`, optional `skeleton="rows|cards|none"`,
   `errorMessage`, `emptyMessage`, `emptyCtaLabel`. Wraps the three existing
   `klar-skeleton-rows` / `klar-error-bar` / `klar-empty-state` primitives — no
   new visual.

### G2. Money input 🔴

`<input hlmInput class="font-mono tabular-nums" type="text" inputmode="decimal"
placeholder="0,00">` appears in **transaction-dialog, recurring-create-dialog,
recurring-edit-dialog, project-create-dialog**. Each hand-parses the value
back to cents via `parseDecimal` or similar.

→ Extract `<klar-money-input [(amountCents)]="…" [allowNegative]="true"
   placeholder="0,00">`. Centralize:
   - DE locale parsing (`,` decimal, optional `.` group)
   - Sign handling (red text when negative, `inputmode="decimal"`)
   - Round-to-cents with `Math.round(value * 100)` (no float drift)
   - `font-mono tabular-nums` baked in
   - 16px min font size (iOS no-zoom rule)
   - Test once, used everywhere.

### G3. Date input 🟡

`<input hlmInput type="date">` in **transaction-dialog, project-create-dialog,
data-export, recurring-*-dialog (start/end date), settings**. Each one converts to
`Temporal.PlainDate` differently.

→ Extract `<klar-date-input [(value)]="…" [min]="…" [max]="…">`. Two-way binds a
   `Temporal.PlainDate | null`, never an ISO string. Internal `<input type="date">` +
   `hlmInput` + 44px min-height + Safari-safe parsing.

### G4. Dialog footer 🟡

`<klar-button tone="ghost" (click)="cancel()">Abbrechen</klar-button>` paired with a
primary action — appears in **13 dialogs** (greppable above). Spacing + responsive
stacking (column-on-mobile / row-on-desktop) is hand-rolled each time.

→ Extract `<klar-dialog-footer>` with named slots `[start]` (rare, for "Delete" on
   left) and primary trailing slot. Default: `<klar-button tone="ghost"
   (click)="dialog.close()">Abbrechen</klar-button>` already wired. Pages
   only provide their primary button.

### G5. Hero / page-stat block 🟡

`monat.component.html` (`.hero-amount` + `.hero-sub`) and `project-detail.component.html`
(`.hero-name` + `.hero-color-dot` + `.hero-actions`) both build a "headline KPI on top
of a card" block with hand-rolled CSS. Different structure but same intent.

→ Extract `<klar-hero>` with slots: `[label]`, `[value]` (auto `font-mono tabular-nums`),
   `[sub]`, `[actions]`. Optional `[colorDot]` input for project pages. Also exposes a
   `[tone]="positive|negative|neutral"` so coloring isn't repeated via `klarMoneyClass`
   on every value.

### G6. Pagination hook → shared 🟡

`apps/web/src/app/pages/admin/tabs/use-paginated-list.ts` is generic but lives under
`pages/admin/`. Buchungen rolls its own pagination in the store; csv-import has its
own bag too.

→ Move to `apps/web/src/app/shared/data/use-paginated-list.ts` (or
   `packages/shared-frontend/data/`). Adopt in `buchungen` and any new cursor-based
   list. Update existing `klar-virtual-list` API to pair cleanly with the controller.

### G7. Window.confirm migration 🔴

`window.confirm()` is used **5× outside Spartan**: `haushalt.component.ts:229,245`,
`fixkosten.component.ts:214`, `project-detail.component.ts:235`,
`category-edit-dialog.component.ts:209`. Plus `confirmReset()` in planspiel uses a
custom path. Browser-native confirm: blocks JS, ugly, can't style, no telemetry.

→ Already covered as `klar-confirm-dialog` in §3 phase S2. Add explicit migration
   tasks in S3 for these 5 sites + planspiel reset.

### G8. Truncated text + tooltip / hover-card 🟡

`csv-preview-row` uses `brnHoverCard` for verbose cell content. Other lists truncate
silently (`overflow-hidden text-ellipsis`) and lose info — buchungen description,
audit-tab args sha, mcp-tab tool name with long params, mail-templates subject.

→ Extract `<klar-truncated [text]="…" [trigger]="hover|click|always">` directive that
   wires tooltip-on-overflow only, using the `hlm-tooltip` from §3 phase S1. Keeps
   the hover-card variant for richer popovers (existing csv-preview-row keeps brn).

### G9. Member avatar pill 🟡

The fixkosten member-filter (lines 65–95) renders `<klar-avatar>`-equivalent buttons
with active-state ring. Same shape would help in: project member list, household
member list, transaction "by user" filter.

→ Combine §3's `klar-segmented` with an `<klar-avatar-pill>` slot variant — or just
   document that `klar-segmented` accepts arbitrary content per item.

### G10. Sticky page header height var 🟢

`admin.component.ts:22` uses `--page-header-h` CSS var to compute `100dvh - header`.
Pages do this differently (some use absolute, some flex). Centralize via an existing
`klar-page-shell` (would need to be created — currently no page-level shell exists,
each page rolls its own padding/max-width).

→ Extract `<klar-page-shell [maxWidth]="…" [padding]="…" [fillHeight]="true">`.
   Owns: `p-4 md:p-6 max-w-X mx-auto`, optional `h-[calc(100dvh - var(--page-header-h))]`,
   safe-area-bottom for iOS PWA. Removes ~5 LOC of boilerplate per page.

### G11. Filter bar standardization 🟢

Admin tabs use `klar-filter-bar` already, but with bespoke children (input + select
in different combos). Buchungen and fixkosten have their own filter strips.

→ Audit `klar-filter-bar` to ensure it accepts the union of (search input, select,
   member pills, date range) as a slotted children pattern. Document the canonical
   composition in `klar-components.spec.ts`.

### Estimate (G-series)

Phases-equivalent:

| Group | Effort | Phase fit |
|-------|--------|-----------|
| G1 async-state | ~3h + tests | parallel to S2 |
| G2 money-input | ~2h + tests, +migration ~2h | S2 |
| G3 date-input | ~1.5h + tests, +migration ~1h | S2 |
| G4 dialog-footer | ~1h, +migration ~2h | S2 |
| G5 hero | ~2h | S2 |
| G6 paginated-list move | ~1h | S2 |
| G7 confirm migration | covered in S3 | S3 |
| G8 truncated tooltip | ~1h after S1 tooltip | S2 |
| G9 avatar-pill | folded into segmented | S2 |
| G10 page-shell | ~2h, +migration ~3h (12 pages × 15min) | S2 |
| G11 filter-bar audit | ~1h | S2 |

Total ≈ **+2 dev days** on top of the Spartan plan. Combined estimate now **5.5–6
dev days**, parallelizable to ~3 days with 2 agents.

---

## 6. Browser-native APIs sweep

Independent grep over `apps/web/src/**` for native UX traps:

| API | Count | Status |
|-----|-------|--------|
| `window.alert(` / `alert(` | **0** | ✅ clean |
| `window.prompt(` / `prompt(` | **0** | ✅ clean |
| `window.confirm(` / `confirm(` (caller use) | **5** | 🔴 covered by G7 → migrate to `klar-confirm-dialog`. Sites: `fixkosten:214`, `haushalt:229,245`, `project-detail:235`, `category-edit-dialog:209`. (`csv-import` and dialog services have a `confirm()` *method* — different, fine.) |
| `console.log/warn/error/info/debug` | **1** | 🟢 only `main.ts:6` `bootstrapApplication(...).catch(console.error)` — pre-bootstrap fallback before Angular logger exists. Acceptable. CLAUDE.md rule still respected for app code. |
| `localStorage.*` | **2** | 🟡 violates CLAUDE.md "einzige localStorage-Ausnahme = PWA install hint": `theme.service.ts` (theme persistence) + `version.service.ts` (`SEEN_VERSION_KEY` for changelog-seen). Both are legitimate UX needs. Decision: either (a) update CLAUDE.md to allow `theme` + `version-seen` as named exceptions, or (b) move to backend user prefs. **Recommend (a)** — cookies/server roundtrip for theme is worse UX. |
| `sessionStorage.*` | **5** | ✅ all in `join`, `login`, `register` for `pendingInviteToken` + `postLoginReturnUrl`. CLAUDE.md doesn't restrict sessionStorage; pattern is correct (cleared on tab close). |

### Action items added to plan

- **§3 Phase S3** task 7 already migrates `planspiel.confirmReset()` to `klar-confirm-dialog`. **Add explicit subtasks** for the 5 `window.confirm()` sites listed above.
- **§5 G7** updated: ensure `klar-confirm-dialog` API supports the existing call shapes:
  - simple yes/no (`Möchtest du diesen Haushalt wirklich verlassen?`)
  - destructive with detail (`Projekt … wirklich löschen?\n(Hat das Projekt Buchungen, wird es stattdessen archiviert.)`) — needs `[detail]` slot for the multi-line subtext.
  - count-aware (`${ids.length} Einträge wirklich löschen?`) — caller composes message; no API change needed.
- **New §5 G12 — localStorage policy:** add a short ADR / update CLAUDE.md to whitelist `theme` and `version-seen` as documented exceptions, OR migrate to user-pref API. Track separately from UI work.
- **CI lint rule (Phase S5):** the existing grep gate should also fail on `window.alert(`, `window.prompt(`, `window.confirm(` (regex `\b(window\.)?(alert|prompt|confirm)\s*\(` minus the `confirm` *method-definition* false positives — gate the call sites only).

---

## 7. Risk register

| Risk | Mitigation |
|------|------------|
| Spartan alpha pin (`0.0.1-alpha.683`) may not ship some helm wrappers | If a `*-helm` pkg is missing at this pin, inline-port the helm component (Spartan helms are MIT) into `shared/ui/hlm/` rather than bumping the brain version. CLAUDE.md says Spartan is pinned. |
| Mass migration breaks layouts | Atomic per-page commits + Playwright smoke per page. |
| Dark-mode regressions on native `<select>` removal | Keep `class="scheme-dark"` requirement in `hlmSelect` directive itself. |
| `confirm()` / `window.confirm` flows currently tested with stubs | Update tests when migrating to `klar-confirm-dialog`. |
