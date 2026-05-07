# Komponenten-Spec + CRUD-Demo Implementation Plan

> Subagent-driven. Continuous execution.

**Goal:** Build the two dev-gallery pages from the bundle: `/app/spec` (component matrix) and `/app/crud` (8 dialog patterns). Admin-only access.

---

## Tasks

### Task 1: Komponenten-Spec page

**File:** `apps/web/src/app/pages/spec/spec.component.ts` (new, inline template).

Add route `/app/spec` in `apps/web/src/app/app.routes.ts`, gated by `AppAdminGuard`. Add sidebar entry under SYSTEM with `--cat-wohnen` tone.

The page renders sections for every primitive in the system:

- **Buttons** — matrix: tones (primary / danger / success / warn / ghost) × variants (soft / solid) × sizes (default / sm) × icon-only. Use `.btn[.tone[.solid]]`.
- **Chips** — `.chip`, `.chip.success`, `.chip.danger`, `.chip.warn`, `.chip.outline`, `.chip.dot`.
- **Inputs** — `.input`, `.input.mono`, `.money-input`, `.field-label`.
- **Cards** — `.card`, `.card-header`, `.row`, `.row.subtotal`, `.row-ico-slot`.
- **Setting rows** — `.setting-row`, `.setting-icon`, `.setting-text`, `.setting-rhs`.
- **Profile card** — `.profile-card.profile-grid` (single sample).
- **Metric tile + Progress ring + Confidence bar + Hypo chip** — one of each via the existing `klar-metric-tile`, `klar-progress-ring`, `klar-confidence-bar`, `klar-hypo-chip`.
- **Animations** — buttons triggering `.klar-pop` and `.klar-pop-center` demo elements.
- **Type scale** — `.eyebrow`, `.serif`, `.mono` samples + Fraunces hero numbers (10, 11, 12, 13, 14, 15, 16, 18, 20, 24, 28, 32, 40, 56).

Each section: `<div class="section-head">…</div>` + `<div class="card">` with the matrix.

**Commit:** `feat(spec): /app/spec dev-gallery for design primitives`

---

### Task 2: CRUD-Demo page

**File:** `apps/web/src/app/pages/crud/crud.component.ts` (new, inline template).

Add route `/app/crud` (admin-only), sidebar entry under SYSTEM with `--cat-freizeit` tone.

8 cards in a grid, each opening the corresponding dialog pattern (using `KlarDialogService` + new sample dialog components):

1. Anlegen (Create)
2. Detail (Read)
3. Bearbeiten (Update)
4. Löschen (Delete with confirm)
5. Verschieben (Move via KSelect)
6. Massenaktion (Multi-select bulk)
7. Pausieren (Toggle state)
8. Verwerfen-Schutz (Unsaved-changes guard)

Each card: title (Fraunces) + sub + `Öffnen` button. Dialogs are minimal demo components in `apps/web/src/app/pages/crud/dialogs/` with a single field + the right action set.

**Commit:** `feat(crud): /app/crud demo with 8 dialog patterns`

---

### Task 3: README + sidebar wiring + verification

Add sidebar entries under SYSTEM in `apps/web/src/app/layout/side-nav/side-nav.component.ts`:

```ts
{ id: 'spec',  label: 'Komponenten',   icon: 'wiederkehrend', route: '/app/spec',  tone: 'var(--cat-wohnen)' },
{ id: 'crud',  label: 'CRUD-Dialoge',  icon: 'list',          route: '/app/crud',  tone: 'var(--cat-freizeit)' },
```

(Pick existing icons from the registry. Both routes admin-only — match the existing `admin` entry's gating pattern.)

README rows:

```
| **🔧 Komponenten-Spec** | Admin-only `/app/spec` page rendering every primitive (buttons × tones × solid/soft × sizes, chips, inputs, cards, setting rows, metric tiles, progress rings, confidence bars, hypo-chips, animations, type scale) |
| **📑 CRUD-Demo** | Admin-only `/app/crud` page with 8 dialog patterns (Anlegen / Detail / Bearbeiten / Löschen / Verschieben / Massenaktion / Pausieren / Verwerfen-Schutz) |
```

Triple build green. Commit: `docs(readme) + sidebar: wire dev-gallery routes`
