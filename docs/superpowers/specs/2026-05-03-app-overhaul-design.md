# Klar — App Overhaul Design Spec

**Date:** 2026-05-03  
**Direction:** Zero Chrome (Direction A)  
**Status:** Approved by user

---

## Problem

The app is visually inconsistent: some pages feel polished, others (especially Planspiel) ignore the design system entirely. The Fixkosten page feels bulky and not lightweight — the stat strip below the header consumes vertical space before any data appears, the left-border category stripe on every individual row multiplies visual weight, and component-scoped CSS creates a fragmented per-page styling world instead of a unified system.

---

## Core Principle: Zero Chrome

**The stat strip pattern is eliminated across the entire app.**

Key numbers move into the top bar on the right side of every page: title on the left, primary metric(s) on the right, month chip. No separate block below the header consuming vertical space.

The category left-border stripe stays on **group headers only** — it is Klar's signature identity element. Individual rows lose the stripe: plain 26px height, just name + day + amount. This was the primary source of the "bulky" feeling on Fixkosten.

All pages converge on the same density: 26px data rows, 10px uppercase section labels, monospace tabular-nums for all amounts.

---

## What Changes Per Page

### Fixkosten

**Topbar (right side):** `ÜBERSCHUSS +1.765,10 €` in sky-400. Month chip. Two ghost icon buttons for STAFFEL and EXPORT (moved from sub-header).

**Sub-header removed entirely.** The month display and action buttons move into the top bar.

**Group headers:** 2px left-border in category color (signature stays) · 5px colored dot · 9px uppercase category name · right-aligned total. Height 26px.

**Individual rows:** 26px height. No left border. Layout: name (flex-1) → frequency suffix (`/ Quartal`, `/ Jahr`) as 8px muted text on same line for non-monthly items → day (9px muted monospace, 22px fixed width, right-aligned) → amount (monospace, 68px fixed width, right-aligned, semantic color).

**Frequency hint rows removed.** Frequency shown inline on the same row as a muted suffix.

**Brand icon on rows removed.** Adds noise at this density without adding information.

---

### Monat

**Topbar (right side):** `ÜBERSCHUSS +1.765 €` in sky-400. Month chip.

**Calendar:** Stays. This is the organizing principle of the page.

**4 stat cards removed.** Replaced with a 4-column inline stat row directly below the calendar, separated by a single hairline. Each stat: 8px uppercase label · 12px monospace value · no subtext. Height ~44px total.

Stat columns: EINGEGANGEN (emerald) · AUSGEGEBEN (rose) · FIXKOSTEN (rose) · VARIABEL (sky).

**Mobile hero surplus block:** Stays unchanged — already reads well.

**Income/expense breakdown:** Stays. Rows tighten to 26px. Labels stay 9px uppercase muted.

**Day-detail bottom sheet:** Unchanged — already follows the design system.

---

### Buchungen

**Topbar:** Month navigation (‹ Mai 2026 ›) moves into the top bar left side, replacing the page title. Right side: three inline stats — income (emerald) · expenses (rose) · netto (semantic color).

**Stat strip removed.**

**Transaction rows:** 26px. Layout: date (9px muted monospace, 28px fixed) → description (flex-1, truncated) → PRIVAT badge inline (8px, only if present) → amount (monospace, 68px, right-aligned, semantic color).

**Brand icon removed** from rows.

---

### Projekte

**Topbar (right side):** Active project count as month chip (e.g., `3 aktiv`).

**Project cards:** Padding tightens to `py-3 px-4`.

**Status badge:** Replaced with a colored dot + 8px uppercase text inline (`● AKTIV` in emerald, `● ABGESCHLOSSEN` in zinc, `● ARCHIVIERT` in zinc-600).

**Progress bar:** Stays. Label changes to `X € Budget · Y %` on one line, 8px muted monospace.

**Stat row:** Three values (BILANZ / AUSGABEN / EINNAHMEN), height 24px. Labels 7px, values 10px mono. No divider lines — spacing only.

**Transaction count:** 8px muted, right-aligned, monospace.

---

### Planspiel

This page receives the most significant change — it currently ignores `system.md` almost entirely.

**Topbar (right side):** `ERGEBNIS +1.200 €` in sky-400 (positive) or rose-400 (negative).

**Result summary card removed.** The result lives in the top bar.

**Entry list:** 26px rows. Left-border 2px in entry's color (already close — just needs system tokens). Layout: 5px colored dot → name (flex-1) → frequency suffix (`/ Monat`, `/ Quartal`, `/ Jahr` in 8px muted) → amount (monospace, 68px, semantic color).

**Income/expense type:** Shown as colored dot before the label, not as a badge.

**Add-entry form:** Reskinned entirely. Background `var(--surface-2)`, borders `var(--border)`, all controls use `hlmInput` / `hlmLabel` / `hlmBtn`. Income/expense toggle becomes two `hlmBtn variant="ghost"` buttons with semantic active states (emerald tint for income, rose tint for expense).

**Dashed "add" button:** Stays — good affordance.

**No generic Tailwind tokens** (`bg-card`, `border-border`, `text-muted-foreground`, `dark:text-white`) — replaced throughout with `var(--surface)`, `var(--border)`, `var(--text-2)`, `var(--text)`.

---

### Settings

**Sections:** `section-body` card wrapper removed. Sections sit directly on page background separated by hairline dividers (`border-t border-(--border)`).

**Field rows:** 26px height. Label (9px uppercase, 90px fixed width, muted) + value side-by-side on one line.

**Profile block:** Avatar 28px. Name 12px medium, email 9px muted. All on one row alongside the avatar — not stacked separately.

**Email verification:** Shown as colored dot inline (4px emerald dot + `Verifiziert` text) instead of a filled badge.

Everything else (password change dialog, OIDC identities, sessions, danger zone) stays structurally the same, tightened to match new density.

---

### Haushalt

Follows the same hairline section pattern as Settings.

**Member rows:** 26px. Avatar 20px with initial + semantic color per user. Name (flex-1) · role (8px muted, right-aligned).

**API keys section:** Compact rows matching the Settings field row pattern.

---

## Shared Changes

### Top Bar Stats Pattern

A new shared pattern for displaying key metrics inline in the top bar:

```html
<div class="tb-right">
  <div class="tb-stat">
    <span class="tb-stat-label">Überschuss</span>
    <span class="tb-stat-val" [ngClass]="...">+1.765 €</span>
  </div>
  <span class="tb-month-chip">Mai 2026</span>
</div>
```

`tb-stat-label`: 8px, uppercase, `--text-muted`  
`tb-stat-val`: 11px, monospace, tabular-nums, semantic color  

This pattern is used on: Fixkosten, Monat, Buchungen, Planspiel.

### CSS Architecture

All per-page component-scoped CSS that duplicates design system tokens is removed. Each page's component CSS file becomes minimal — layout-only rules that cannot be expressed as Tailwind utilities (e.g., custom row heights if needed). Color, spacing, typography, and border tokens come exclusively from `system.md` via CSS variables and Tailwind utilities.

### Components Not Changed

- `klar-month-picker` — still used internally by Buchungen topbar logic, but rendered inline not as a block
- `klar-dialog.service` + `klar-dialog.component` — unchanged
- `hlm-calendar` — unchanged
- Bottom nav / sidebar shell — unchanged
- All dialog components (transaction-dialog, recurring-edit-dialog, etc.) — unchanged
- Auth pages (login, register, verify-email, onboarding) — not in scope

### Components Affected

- `klar-stat-card` — **deprecated**. The mobile hero on Monat uses a custom inline layout; no page uses the card pattern after this overhaul. Component file stays but is not imported anywhere.
- `klar-skeleton-cards` — **deprecated**. Stat cards are gone; skeleton rows (`klar-skeleton-rows`) cover all loading states. Component file stays but is not imported anywhere.
- `klar-month-picker` — display-only version used as inline topbar element on Buchungen; the block-level usage is removed
- `klar-section-header` — stays; sections now separate via hairlines only, no card wrapping

### Row Height Override

The current `system.md` specifies `--spacing-table-row: 35px` for finance table rows. This overhaul changes all data rows to **26px**. The CSS variable `--spacing-table-row` is updated to `26px` in `styles.css`. This is the single biggest contributor to removing the "bulky" feeling.

---

## Design Constraints Maintained

All constraints from `system.md` and `CLAUDE.md` remain in force:

- No `font-size < 16px` on form inputs (iOS zoom prevention)
- No `100vh` — always `100dvh`
- No shadows — borders only for depth
- All monetary values: monospace + tabular-nums
- Category identity: left-border 2px on group headers
- Section headers: 9-10px uppercase tracking-widest muted — never custom
- Safe-area insets on fixed/sticky elements
- Touch targets ≥ 44×44px on mobile

---

## Out of Scope

- Auth pages (login, register, verify-email, onboarding, auth-callback)
- Dialog/modal content (transaction-dialog, recurring-edit-dialog, change-password-dialog, delete-account-dialog) — visual language improves by inheriting the new page styles, but no structural changes
- Backend / API changes
- New features or new pages
- Light mode refinement (out of scope for this overhaul)
