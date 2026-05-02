# Modal / Dialog System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a reusable app-wide modal/dialog system so every edit in Klar opens in a dialog — never inline in list rows.

**Architecture:** A signal-based `KlarDialogService` holds the currently active dialog config (component type + inputs + title). A `KlarDialogComponent` shell (mounted once in the shell) renders the active dialog using Angular's `NgComponentOutlet` + `ngComponentOutletInputs`. Content components are self-contained — they call `dialogService.close()` on save/cancel and `overviewStore.reload()` after a successful mutation.

**Tech Stack:** Angular 21 Signals, `NgComponentOutlet` + `ngComponentOutletInputs`, `KlarInputComponent`, `KlarButtonComponent`, existing design tokens, `RecurringTransactionsService` for PATCH.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `apps/web/src/app/shared/ui/klar-dialog.service.ts` | Singleton: holds active dialog state, open/close API |
| Create | `apps/web/src/app/shared/ui/klar-dialog.component.ts` | Backdrop + panel shell, renders content via NgComponentOutlet |
| Create | `apps/web/src/app/shared/ui/klar-dialog.component.html` | Dialog HTML structure |
| Create | `apps/web/src/app/shared/ui/klar-dialog.component.css` | Backdrop, panel, animation styles |
| Modify | `apps/web/src/app/layout/shell/shell.component.ts` | Import KlarDialogComponent |
| Modify | `apps/web/src/app/layout/shell/shell.component.html` | Mount `<klar-dialog />` outlet |
| Create | `apps/web/src/app/pages/fixkosten/recurring-edit-dialog.component.ts` | Edit form for a single recurring transaction |
| Create | `apps/web/src/app/pages/fixkosten/recurring-edit-dialog.component.html` | Form template |
| Create | `apps/web/src/app/pages/fixkosten/recurring-edit-dialog.component.css` | Form layout styles |
| Modify | `apps/web/src/app/pages/fixkosten/fixkosten.component.ts` | Remove inline edit state, add `openEdit()` |
| Modify | `apps/web/src/app/pages/fixkosten/fixkosten.component.html` | Simplify row: click → openEdit, remove edit-row template |
| Modify | `apps/web/src/app/pages/fixkosten/fixkosten.component.css` | Remove edit-input styles, keep hover hint |

---

## Task 1 — `KlarDialogService`

**Files:**
- Create: `apps/web/src/app/shared/ui/klar-dialog.service.ts`

- [ ] **Write the service**

```ts
// apps/web/src/app/shared/ui/klar-dialog.service.ts
import { Injectable, signal, Type } from '@angular/core';

export interface DialogConfig {
  title: string;
  component: Type<unknown>;
  inputs?: Record<string, unknown>;
  width?: 'sm' | 'md' | 'lg';
  /** If true, clicking the backdrop does not close the dialog */
  disableBackdropClose?: boolean;
}

@Injectable({ providedIn: 'root' })
export class KlarDialogService {
  readonly active = signal<DialogConfig | null>(null);

  open(config: DialogConfig): void {
    this.active.set({ width: 'md', ...config });
  }

  close(): void {
    this.active.set(null);
  }
}
```

- [ ] **Verify: no TypeScript errors** (`pnpm --filter @klar/web lint` or open Problems panel — expect 0 errors)

---

## Task 2 — `KlarDialogComponent` (shell)

**Files:**
- Create: `apps/web/src/app/shared/ui/klar-dialog.component.ts`
- Create: `apps/web/src/app/shared/ui/klar-dialog.component.html`
- Create: `apps/web/src/app/shared/ui/klar-dialog.component.css`

- [ ] **Write the component**

```ts
// apps/web/src/app/shared/ui/klar-dialog.component.ts
import { Component, inject, HostListener } from '@angular/core';
import { NgComponentOutlet } from '@angular/common';
import { KlarDialogService } from './klar-dialog.service';
import { KlarIconComponent } from '../icons/klar-icon.component';

@Component({
  selector: 'klar-dialog',
  standalone: true,
  imports: [NgComponentOutlet, KlarIconComponent],
  templateUrl: './klar-dialog.component.html',
  styleUrl: './klar-dialog.component.css',
})
export class KlarDialogComponent {
  protected dialog = inject(KlarDialogService);

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.dialog.active()) this.dialog.close();
  }

  onBackdropClick(event: MouseEvent): void {
    if (this.dialog.active()?.disableBackdropClose) return;
    if ((event.target as HTMLElement).classList.contains('backdrop')) {
      this.dialog.close();
    }
  }
}
```

- [ ] **Write the template**

```html
<!-- apps/web/src/app/shared/ui/klar-dialog.component.html -->
@if (dialog.active(); as cfg) {
  <div class="backdrop" (click)="onBackdropClick($event)" role="dialog"
       [attr.aria-label]="cfg.title" aria-modal="true">
    <div class="panel panel--{{ cfg.width }}">
      <div class="panel-header">
        <span class="panel-title">{{ cfg.title }}</span>
        <button class="close-btn" type="button" title="Schließen" (click)="dialog.close()">
          <klar-icon name="x" [size]="14" />
        </button>
      </div>
      <div class="panel-body">
        <ng-container
          [ngComponentOutlet]="cfg.component"
          [ngComponentOutletInputs]="cfg.inputs ?? {}" />
      </div>
    </div>
  </div>
}
```

- [ ] **Write the CSS**

```css
/* apps/web/src/app/shared/ui/klar-dialog.component.css */
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: color-mix(in oklab, var(--zinc-950) 60%, transparent);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px 16px;
  animation: klar-fade 120ms ease both;
}

.panel {
  position: relative;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  display: flex;
  flex-direction: column;
  max-height: calc(100dvh - 48px);
  width: 100%;
  animation: klar-enter 160ms ease both;
  box-shadow: 0 24px 48px color-mix(in oklab, var(--zinc-950) 40%, transparent);
}

.panel--sm { max-width: 360px; }
.panel--md { max-width: 480px; }
.panel--lg { max-width: 640px; }

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.panel-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: none;
  color: var(--text-muted);
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: color 100ms, background 100ms;
}

.close-btn:hover {
  color: var(--text);
  background: color-mix(in oklab, var(--text) 8%, transparent);
}

.panel-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

@media (max-width: 767px) {
  .backdrop {
    align-items: flex-end;
    padding: 0;
  }

  .panel {
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    max-height: 90dvh;
    max-width: 100%;
    padding-bottom: env(safe-area-inset-bottom);
  }
}
```

- [ ] **Verify: no TypeScript errors in Problems panel**

---

## Task 3 — Mount dialog outlet in shell

**Files:**
- Modify: `apps/web/src/app/layout/shell/shell.component.ts`
- Modify: `apps/web/src/app/layout/shell/shell.component.html`

- [ ] **Add import to shell component**

In `shell.component.ts`, add `KlarDialogComponent` to the `imports` array:

```ts
import { KlarDialogComponent } from '../../shared/ui/klar-dialog.component';

// in @Component decorator:
imports: [..., KlarDialogComponent],
```

- [ ] **Add outlet to shell template**

In `shell.component.html`, add `<klar-dialog />` directly before `<klar-toast-container />`:

```html
<!-- Global dialog outlet -->
<klar-dialog />

<!-- Global toast container -->
<klar-toast-container />
```

- [ ] **Verify: app loads, no console errors**

---

## Task 4 — `RecurringEditDialogComponent` (fixkosten edit form)

**Files:**
- Create: `apps/web/src/app/pages/fixkosten/recurring-edit-dialog.component.ts`
- Create: `apps/web/src/app/pages/fixkosten/recurring-edit-dialog.component.html`
- Create: `apps/web/src/app/pages/fixkosten/recurring-edit-dialog.component.css`

This component is the dialog *content* — it is mounted by `KlarDialogComponent` via `NgComponentOutlet`.

- [ ] **Write the component**

```ts
// apps/web/src/app/pages/fixkosten/recurring-edit-dialog.component.ts
import { Component, inject, input, signal, computed } from '@angular/core';
import { KlarDialogService } from '../../shared/ui/klar-dialog.service';
import { KlarButtonComponent } from '../../shared/ui/klar-button.component';
import { KlarInputComponent } from '../../shared/ui/klar-input.component';
import { KlarIconComponent } from '../../shared/icons/klar-icon.component';
import { OverviewStore } from '../../core/overview/overview.store';
import { HouseholdStore } from '../../core/household/household.store';
import { RecurringTransactionsService } from '../../core/recurring-transactions/recurring-transactions.service';
import { KlarToastService } from '../../shared/ui/klar-toast.service';
import type { FixedCostItem } from '../../core/overview/overview.service';
import type { RecurringFrequency } from '@klar/shared';

@Component({
  selector: 'app-recurring-edit-dialog',
  standalone: true,
  imports: [KlarButtonComponent, KlarInputComponent, KlarIconComponent],
  templateUrl: './recurring-edit-dialog.component.html',
  styleUrl: './recurring-edit-dialog.component.css',
})
export class RecurringEditDialogComponent {
  // Passed via ngComponentOutletInputs
  item = input.required<FixedCostItem>();

  private dialog     = inject(KlarDialogService);
  private store      = inject(OverviewStore);
  private household  = inject(HouseholdStore);
  private recurring  = inject(RecurringTransactionsService);
  private toast      = inject(KlarToastService);

  // Form state
  readonly name       = signal('');
  readonly monthly    = signal(''); // display string e.g. "-298,97"
  readonly saving     = signal(false);
  readonly error      = signal('');

  // Initialise from item once available
  // (input() signals resolve after construction so we use a computed side-effect pattern)
  readonly _init = computed(() => {
    const i = this.item();
    this.name.set(i.name);
    this.monthly.set(this.centsToDisplay(i.monthlyEquivalentCents));
  });

  readonly isValid = computed(() => {
    const n = this.name().trim();
    const m = this.parseCents(this.monthly());
    return n.length > 0 && !isNaN(m);
  });

  readonly frequencyHint = computed(() => {
    const freq = this.item().frequency;
    if (freq === 'MONTHLY') return '';
    const map: Record<string, string> = {
      QUARTERLY:   '× 3 = Quartalsbetrag',
      YEARLY:      '× 12 = Jahresbetrag',
      CUSTOM_DAYS: 'Individuell',
    };
    return map[freq] ?? '';
  });

  async save(): Promise<void> {
    if (!this.isValid() || this.saving()) return;
    const hid = this.household.activeId();
    if (!hid) return;

    const monthlyCents = this.parseCents(this.monthly());
    const actualCents  = this.toActualCents(monthlyCents, this.item().frequency);

    this.saving.set(true);
    this.error.set('');
    try {
      await this.recurring.patch(hid, this.item().id, {
        name:        this.name().trim(),
        amountCents: actualCents,
      });
      this.store.reload();
      this.dialog.close();
      this.toast.success('Gespeichert');
    } catch {
      this.error.set('Speichern fehlgeschlagen. Bitte erneut versuchen.');
    } finally {
      this.saving.set(false);
    }
  }

  cancel(): void {
    this.dialog.close();
  }

  // ── Helpers ───────────────────────────────────────────────────────

  private centsToDisplay(cents: number): string {
    return (cents / 100).toFixed(2).replace('.', ',');
  }

  private parseCents(value: string): number {
    const n = parseFloat(value.replace(',', '.').replace(/[^0-9.\-]/g, ''));
    return Math.round(n * 100);
  }

  private toActualCents(monthlyCents: number, freq: RecurringFrequency): number {
    if (freq === 'QUARTERLY') return Math.round(monthlyCents * 3);
    if (freq === 'YEARLY')    return Math.round(monthlyCents * 12);
    return monthlyCents;
  }
}
```

- [ ] **Write the template**

```html
<!-- apps/web/src/app/pages/fixkosten/recurring-edit-dialog.component.html -->
<!-- trigger init computed -->
<span style="display:none">{{ _init() }}</span>

<div class="form">
  <klar-input
    label="Name"
    [placeholder]="item().name"
    [value]="name()"
    (valueChange)="name.set($event)" />

  <div class="amount-row">
    <klar-input
      label="Betrag/Monat (€)"
      type="text"
      inputmode="decimal"
      [placeholder]="'0,00'"
      [value]="monthly()"
      (valueChange)="monthly.set($event)" />
    @if (frequencyHint()) {
      <span class="freq-hint">{{ frequencyHint() }}</span>
    }
  </div>

  <div class="meta-row">
    <span class="meta-label">Frequenz</span>
    <span class="meta-value">{{ item().frequency }}</span>
  </div>

  @if (item().dayOfMonth) {
    <div class="meta-row">
      <span class="meta-label">Buchungstag</span>
      <span class="meta-value">{{ item().dayOfMonth }}. des Monats</span>
    </div>
  }

  @if (error()) {
    <p class="error-msg">{{ error() }}</p>
  }

  <div class="actions">
    <klar-button variant="ghost" label="Abbrechen" (clicked)="cancel()" />
    <klar-button
      variant="primary"
      label="Speichern"
      [loading]="saving()"
      [disabled]="!isValid()"
      (clicked)="save()" />
  </div>
</div>
```

- [ ] **Write the CSS**

```css
/* apps/web/src/app/pages/fixkosten/recurring-edit-dialog.component.css */
.form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.amount-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.freq-hint {
  font-size: 11px;
  color: var(--text-muted);
  padding-left: 2px;
}

.meta-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
  border-top: 1px solid var(--border-subtle, var(--border));
}

.meta-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
}

.meta-value {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text);
}

.error-msg {
  font-size: 13px;
  color: var(--color-expense);
  padding: 8px 12px;
  background: color-mix(in oklab, var(--color-expense) 8%, transparent);
  border-radius: var(--radius-sm);
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 4px;
}
```

- [ ] **Verify: no TypeScript errors**

---

## Task 5 — Simplify fixkosten component

Remove all inline-edit state and wire rows to open the dialog.

**Files:**
- Modify: `apps/web/src/app/pages/fixkosten/fixkosten.component.ts`
- Modify: `apps/web/src/app/pages/fixkosten/fixkosten.component.html`
- Modify: `apps/web/src/app/pages/fixkosten/fixkosten.component.css`

- [ ] **Update `fixkosten.component.ts`**

Replace the inline-edit signals and methods with a single `openEdit()` method:

```ts
// Remove: editingId, editName, editMonthly, localEdits, startEdit, confirmEdit, cancelEdit,
//         onEditKeydown, _applyPendingEdit, _parseCents, _centsToDisplay, _toActualCents
// Remove: HouseholdStore and RecurringTransactionsService imports
// Add: KlarDialogService and RecurringEditDialogComponent imports

import { KlarDialogService } from '../../shared/ui/klar-dialog.service';
import { RecurringEditDialogComponent } from './recurring-edit-dialog.component';
import type { FixedCostItem } from '../../core/overview/overview.service';

// Add to class:
private dialogService = inject(KlarDialogService);

openEdit(item: FixedCostItem, event: Event): void {
  event.stopPropagation(); // don't toggle group collapse
  this.dialogService.open({
    title: 'Eintrag bearbeiten',
    component: RecurringEditDialogComponent,
    inputs: { item },
    width: 'sm',
  });
}

// Change enrichedGroups to simply:
readonly enrichedGroups = computed(() => this.store.fixedCosts()?.groups ?? []);

// Keep all other computeds (incomeTotalCents, etc.) but based on enrichedGroups
```

- [ ] **Update `fixkosten.component.html`**

Replace the inline edit-row with a simple click-to-open on the view row. Remove the `@if (editingId() === item.id)` branch entirely:

```html
<!-- Replace the two-branch @if/else for each item with just the view row: -->
<div class="ledger-row" (click)="openEdit(item, $event)">
  <span class="row-arrow">↳</span>
  <span class="row-name">{{ item.name }}</span>
  @if (item.isVariable) {
    <span class="row-variable">variabel</span>
  }
  <span class="row-day">{{ formatDay(item.dayOfMonth) }}</span>
  <span class="row-amount"
        [class.income]="item.monthlyEquivalentCents > 0"
        [class.expense]="item.monthlyEquivalentCents < 0">
    @if (item.isVariable) { ~ }{{ formatCents(item.monthlyEquivalentCents) }}
  </span>
  <span class="row-edit-hint">
    <klar-icon name="pencil" [size]="10" />
  </span>
</div>
```

- [ ] **Update `fixkosten.component.css`**

Remove the `.editing`, `.edit-name`, `.edit-amount`, `.edit-cancel` rules. Keep `.row-edit-hint`.

- [ ] **Verify: no TypeScript errors, app builds**

---

## Task 6 — Manual smoke test

- [ ] Open the app at `http://localhost:4200` (run `pnpm dev` if not running)
- [ ] Navigate to Fixkosten
- [ ] Click any entry row → dialog opens with correct title, pre-filled name and amount
- [ ] Change name → Save → toast "Gespeichert" appears, list reloads with new name, group total recalculates
- [ ] Change amount (e.g. "-50,00" for a monthly item) → Save → group total updates correctly
- [ ] For a quarterly item: verify the freq hint "× 3 = Quartalsbetrag" is visible
- [ ] Escape key → dialog closes
- [ ] Backdrop click → dialog closes
- [ ] X button → dialog closes
- [ ] On mobile (375px viewport): dialog slides up from bottom as sheet

---

## Self-Review Checklist

- [x] **Spec coverage:** Service (Task 1) ✓, Shell (Tasks 2-3) ✓, Edit dialog content (Task 4) ✓, Fixkosten wired up (Task 5) ✓, tested (Task 6) ✓
- [x] **No placeholders:** All code blocks are complete
- [x] **Type consistency:** `FixedCostItem` used consistently across Task 4 and Task 5; `KlarDialogService.open()` signature matches usage
- [x] **Mobile:** Dialog slides up from bottom on mobile via CSS (Task 2 CSS)
- [x] **Accessibility:** `role="dialog"`, `aria-modal="true"`, `aria-label` on backdrop; close button has `title`; Escape key closes
- [x] **Frequency reversal:** `toActualCents()` in dialog correctly multiplies for QUARTERLY/YEARLY before PATCH
