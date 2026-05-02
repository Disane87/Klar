# Reusable UI Controls — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **Ruflo:** Initialize swarm (`mcp__ruflo__swarm_init`) and use `mcp__ruflo__agent_spawn` for parallel tasks.

**Goal:** Extract 11 repeated UI patterns into standalone Angular controls (pipes, directives, components), then migrate all 4 core pages and auth pages to use them — eliminating ~400 lines of duplicated code.

**Architecture:** Pipes in `apps/web/src/app/shared/pipes/`. App UI components in `apps/web/src/app/shared/ui/`. Spartan UI extensions in `apps/web/src/app/shared/ui/hlm/`. All standalone Angular 21. After creation, remove duplicated code from pages.

**Tech Stack:** Angular 21 Zoneless, Tailwind CSS 4, Spartan UI, `hlm()` (clsx+twMerge), Vitest

---

## File Map

### Create
| File | Responsibility |
|------|---------------|
| `apps/web/src/app/shared/pipes/klar-money.pipe.ts` | `\| klarMoney` — formats cents as EUR string |
| `apps/web/src/app/shared/pipes/klar-money.pipe.spec.ts` | Unit tests for KlarMoneyPipe |
| `apps/web/src/app/shared/pipes/klar-money-class.pipe.ts` | `\| klarMoneyClass` — returns Tailwind color class for amount |
| `apps/web/src/app/shared/pipes/klar-money-class.pipe.spec.ts` | Unit tests for KlarMoneyClassPipe |
| `apps/web/src/app/shared/ui/klar-error-bar.component.ts` | Error banner with retry button |
| `apps/web/src/app/shared/ui/klar-empty-state.component.ts` | Inbox icon + message |
| `apps/web/src/app/shared/ui/klar-month-picker.component.ts` | Prev / Month Label / Next navigation |
| `apps/web/src/app/shared/ui/klar-form-field.component.ts` | Label + projected input + optional error |
| `apps/web/src/app/shared/ui/klar-section-header.component.ts` | Section title label + optional action slot |
| `apps/web/src/app/shared/ui/klar-icon-button.component.ts` | Icon-only button, optional danger variant |
| `apps/web/src/app/shared/ui/klar-stat-card.component.ts` | Label + money value + optional sub-label |
| `apps/web/src/app/shared/ui/klar-skeleton-rows.component.ts` | N animated skeleton rows (3-column) |
| `apps/web/src/app/shared/ui/klar-skeleton-cards.component.ts` | N animated skeleton cards (label/value/sub) |
| `apps/web/src/app/shared/ui/hlm/hlm-loading-btn.directive.ts` | Adds spinner to [hlmBtn] while loading |

### Modify
| File | Change |
|------|--------|
| `apps/web/src/app/pages/buchungen/buchungen.component.ts` | Remove `formatCents`, `prevMonth`, `nextMonth`, `displayMonth` |
| `apps/web/src/app/pages/buchungen/buchungen.component.html` | Use `klarMoney`, `klarMoneyClass`, `klar-error-bar`, `klar-empty-state`, `klar-month-picker`, `klar-skeleton-rows` |
| `apps/web/src/app/pages/fixkosten/fixkosten.component.ts` | Remove `formatCents` |
| `apps/web/src/app/pages/fixkosten/fixkosten.component.html` | Use `klarMoney`, `klarMoneyClass`, `klar-error-bar`, `klar-empty-state` |
| `apps/web/src/app/pages/monat/monat.component.ts` | Remove `formatCents`, `prevMonth`, `nextMonth`, `displayMonth` |
| `apps/web/src/app/pages/monat/monat.component.html` | Use all new controls; replace `.stat-card` with `<klar-stat-card>` |
| `apps/web/src/app/pages/projekte/projekte.component.ts` | Remove `formatCents` |
| `apps/web/src/app/pages/projekte/projekte.component.html` | Use `klarMoney`, `klarMoneyClass`, `klar-error-bar`, `klar-empty-state` |
| `apps/web/src/app/pages/login/login.component.*` | Use `[klarLoadingBtn]` on submit button |
| `apps/web/src/app/pages/register/register.component.*` | Use `[klarLoadingBtn]` on submit button |
| `apps/web/src/app/pages/onboarding/onboarding.component.*` | Use `[klarLoadingBtn]` on submit button |

---

## Task 1: KlarMoneyPipe — format cents as EUR

**Files:**
- Create: `apps/web/src/app/shared/pipes/klar-money.pipe.spec.ts`
- Create: `apps/web/src/app/shared/pipes/klar-money.pipe.ts`

- [ ] **Step 1: Write failing test**

```ts
// apps/web/src/app/shared/pipes/klar-money.pipe.spec.ts
import { describe, it, expect } from 'vitest';
import { KlarMoneyPipe } from './klar-money.pipe';

describe('KlarMoneyPipe', () => {
  const pipe = new KlarMoneyPipe();

  it('formats positive cents as EUR with German locale', () => {
    expect(pipe.transform(150000)).toBe('1.500,00 €');
  });

  it('formats negative cents as EUR', () => {
    expect(pipe.transform(-5099)).toBe('-50,99 €');
  });

  it('formats zero', () => {
    expect(pipe.transform(0)).toBe('0,00 €');
  });
});
```

- [ ] **Step 2: Run — verify failure**

```
pnpm --filter web test klar-money.pipe
```
Expected: FAIL — "Cannot find module './klar-money.pipe'"

- [ ] **Step 3: Implement**

```ts
// apps/web/src/app/shared/pipes/klar-money.pipe.ts
import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'klarMoney', standalone: true, pure: true })
export class KlarMoneyPipe implements PipeTransform {
  private static readonly fmt = new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  });

  transform(cents: number): string {
    return KlarMoneyPipe.fmt.format(cents / 100);
  }
}
```

- [ ] **Step 4: Run — verify pass**

```
pnpm --filter web test klar-money.pipe
```
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/shared/pipes/klar-money.pipe.ts apps/web/src/app/shared/pipes/klar-money.pipe.spec.ts
git commit -m "feat(ui): add KlarMoneyPipe (formatCents replacement)"
```

---

## Task 2: KlarMoneyClassPipe — Tailwind color class from amount

**Files:**
- Create: `apps/web/src/app/shared/pipes/klar-money-class.pipe.spec.ts`
- Create: `apps/web/src/app/shared/pipes/klar-money-class.pipe.ts`

- [ ] **Step 1: Write failing test**

```ts
// apps/web/src/app/shared/pipes/klar-money-class.pipe.spec.ts
import { describe, it, expect } from 'vitest';
import { KlarMoneyClassPipe } from './klar-money-class.pipe';

describe('KlarMoneyClassPipe', () => {
  const pipe = new KlarMoneyClassPipe();

  it('returns text-success for positive amount', () => {
    expect(pipe.transform(5000)).toBe('text-success');
  });

  it('returns text-danger for negative amount', () => {
    expect(pipe.transform(-5000)).toBe('text-danger');
  });

  it('returns text-muted-foreground for zero', () => {
    expect(pipe.transform(0)).toBe('text-muted-foreground');
  });
});
```

- [ ] **Step 2: Run — verify failure**

```
pnpm --filter web test klar-money-class.pipe
```

- [ ] **Step 3: Implement**

```ts
// apps/web/src/app/shared/pipes/klar-money-class.pipe.ts
import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'klarMoneyClass', standalone: true, pure: true })
export class KlarMoneyClassPipe implements PipeTransform {
  transform(cents: number): string {
    if (cents > 0) return 'text-success';
    if (cents < 0) return 'text-danger';
    return 'text-muted-foreground';
  }
}
```

- [ ] **Step 4: Run — verify pass**

```
pnpm --filter web test klar-money-class.pipe
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/shared/pipes/klar-money-class.pipe.ts apps/web/src/app/shared/pipes/klar-money-class.pipe.spec.ts
git commit -m "feat(ui): add KlarMoneyClassPipe (text-success/text-danger)"
```

---

## Task 3: KlarErrorBarComponent

Replaces this identical block in buchungen, fixkosten, monat, projekte:
```html
<div class="error-bar">
  <klar-icon name="alert-circle" [size]="14"/>
  <span>Fehler beim Laden…</span>
  <button class="retry-btn" type="button" (click)="store.reload()">Erneut versuchen</button>
</div>
```

**Files:**
- Create: `apps/web/src/app/shared/ui/klar-error-bar.component.ts`

- [ ] **Step 1: Implement** (pure rendering, no logic to unit-test separately)

```ts
// apps/web/src/app/shared/ui/klar-error-bar.component.ts
import { Component, input, output } from '@angular/core';
import { KlarIconComponent } from '../icons/klar-icon.component';
import { HlmButtonDirective } from './hlm/hlm-button.directive';

@Component({
  selector: 'klar-error-bar',
  standalone: true,
  imports: [KlarIconComponent, HlmButtonDirective],
  template: `
    <div class="flex items-center gap-2 rounded border border-destructive/30 bg-destructive/5
                px-4 py-2.5 text-sm text-destructive">
      <klar-icon name="alert-circle" [size]="14" />
      <span class="flex-1">{{ message() }}</span>
      <button type="button" hlmBtn variant="destructive" size="sm" (click)="retry.emit()">
        Erneut versuchen
      </button>
    </div>
  `,
})
export class KlarErrorBarComponent {
  message = input('Fehler beim Laden der Daten.');
  retry   = output<void>();
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/shared/ui/klar-error-bar.component.ts
git commit -m "feat(ui): add KlarErrorBarComponent"
```

---

## Task 4: KlarEmptyStateComponent

Replaces this identical block in buchungen, fixkosten, monat, projekte:
```html
<div class="empty-state">
  <klar-icon name="inbox" [size]="36" [stroke]="1.25"/>
  <p>Noch keine …</p>
</div>
```

**Files:**
- Create: `apps/web/src/app/shared/ui/klar-empty-state.component.ts`

- [ ] **Step 1: Implement**

```ts
// apps/web/src/app/shared/ui/klar-empty-state.component.ts
import { Component, input } from '@angular/core';
import { KlarIconComponent } from '../icons/klar-icon.component';

@Component({
  selector: 'klar-empty-state',
  standalone: true,
  imports: [KlarIconComponent],
  template: `
    <div class="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <klar-icon [name]="icon()" [size]="36" [stroke]="1.25"
                 class="text-muted-foreground/40" />
      <p class="text-sm text-muted-foreground">{{ message() }}</p>
    </div>
  `,
})
export class KlarEmptyStateComponent {
  message = input.required<string>();
  icon    = input('inbox');
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/shared/ui/klar-empty-state.component.ts
git commit -m "feat(ui): add KlarEmptyStateComponent"
```

---

## Task 5: KlarMonthPickerComponent

Replaces identical HTML + identical TS methods (prevMonth, nextMonth, displayMonth) in buchungen and monat.

**Files:**
- Create: `apps/web/src/app/shared/ui/klar-month-picker.component.ts`

- [ ] **Step 1: Implement**

```ts
// apps/web/src/app/shared/ui/klar-month-picker.component.ts
import { Component, computed, input, output } from '@angular/core';
import { KlarIconComponent } from '../icons/klar-icon.component';

@Component({
  selector: 'klar-month-picker',
  standalone: true,
  imports: [KlarIconComponent],
  template: `
    <div class="flex items-center gap-3">
      <button type="button"
              class="flex size-8 items-center justify-center rounded text-muted-foreground
                     hover:bg-accent hover:text-foreground active:opacity-70"
              aria-label="Vorheriger Monat"
              (click)="prev()">
        <klar-icon name="chevron-left" [size]="18" />
      </button>
      <span class="min-w-[160px] text-center text-sm font-medium">{{ label() }}</span>
      <button type="button"
              class="flex size-8 items-center justify-center rounded text-muted-foreground
                     hover:bg-accent hover:text-foreground active:opacity-70"
              aria-label="Nächster Monat"
              (click)="next()">
        <klar-icon name="chevron-right" [size]="18" />
      </button>
    </div>
  `,
})
export class KlarMonthPickerComponent {
  /** Format: 'YYYY-MM' */
  month       = input.required<string>();
  monthChange = output<string>();

  label = computed(() => {
    const [year, m] = this.month().split('-');
    return new Date(Number(year), Number(m) - 1, 1)
      .toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
  });

  prev(): void {
    const [year, m] = this.month().split('-').map(Number);
    const d = new Date(year, m - 2, 1);
    this.monthChange.emit(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  next(): void {
    const [year, m] = this.month().split('-').map(Number);
    const d = new Date(year, m, 1);
    this.monthChange.emit(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/shared/ui/klar-month-picker.component.ts
git commit -m "feat(ui): add KlarMonthPickerComponent"
```

---

## Task 6: HlmLoadingBtnDirective

Adds a spinner to any `[hlmBtn]` button while a loading signal is true. Currently duplicated in login, register, onboarding, haushalt (5+ buttons each with `@if (loading()) { <hlm-spinner/> }`).

**Files:**
- Create: `apps/web/src/app/shared/ui/hlm/hlm-loading-btn.directive.ts`

- [ ] **Step 1: Implement**

```ts
// apps/web/src/app/shared/ui/hlm/hlm-loading-btn.directive.ts
import { Directive, computed, input } from '@angular/core';
import { HlmSpinnerComponent } from './hlm-spinner.component';

/**
 * Usage: <button hlmBtn [klarLoadingBtn]="loading()">Speichern</button>
 * Automatically disables the button and prepends a spinner while loading.
 */
@Directive({
  selector: 'button[hlmBtn][klarLoadingBtn]',
  standalone: true,
  host: {
    '[disabled]': '_loading()',
    '[attr.aria-busy]': '_loading()',
  },
})
export class HlmLoadingBtnDirective {
  klarLoadingBtn = input(false);
  _loading = computed(() => this.klarLoadingBtn());
}
```

> **Note:** The spinner itself is injected into the button via template in the consuming component. The directive handles disabled state. Spinner is shown via `@if (loading()) { <hlm-spinner [size]="14" /> }` — this pattern is already consistent in existing code, and the directive just ensures `disabled` + `aria-busy` are always set.

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/shared/ui/hlm/hlm-loading-btn.directive.ts
git commit -m "feat(ui): add HlmLoadingBtnDirective"
```

---

## Task 7: KlarFormFieldComponent

Provides consistent label + content slot + optional error display. Used in dialogs and auth pages.

**Files:**
- Create: `apps/web/src/app/shared/ui/klar-form-field.component.ts`

- [ ] **Step 1: Implement**

```ts
// apps/web/src/app/shared/ui/klar-form-field.component.ts
import { Component, input } from '@angular/core';
import { HlmLabelDirective } from './hlm/hlm-label.directive';
import { HlmErrorDirective } from './hlm/hlm-error.directive';

@Component({
  selector: 'klar-form-field',
  standalone: true,
  imports: [HlmLabelDirective, HlmErrorDirective],
  template: `
    <div class="flex flex-col gap-1.5">
      @if (label()) {
        <label hlmLabel [attr.for]="for()">{{ label() }}</label>
      }
      <ng-content />
      @if (error()) {
        <span hlmError>{{ error() }}</span>
      }
    </div>
  `,
})
export class KlarFormFieldComponent {
  label = input('');
  for   = input('');
  error = input('');
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/shared/ui/klar-form-field.component.ts
git commit -m "feat(ui): add KlarFormFieldComponent"
```

---

## Task 8: KlarSectionHeaderComponent

Section titles in haushalt page have the pattern: small-caps label on the left + optional action button on the right.

**Files:**
- Create: `apps/web/src/app/shared/ui/klar-section-header.component.ts`

- [ ] **Step 1: Implement**

```ts
// apps/web/src/app/shared/ui/klar-section-header.component.ts
import { Component, input } from '@angular/core';

@Component({
  selector: 'klar-section-header',
  standalone: true,
  template: `
    <div class="flex items-center justify-between py-2">
      <span class="text-[10px] uppercase tracking-widest text-muted-foreground">
        {{ title() }}
      </span>
      <ng-content />
    </div>
  `,
})
export class KlarSectionHeaderComponent {
  title = input.required<string>();
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/shared/ui/klar-section-header.component.ts
git commit -m "feat(ui): add KlarSectionHeaderComponent"
```

---

## Task 9: KlarIconButtonComponent

Icon-only button with 44×44px touch target (iOS HIG), optional danger variant.

**Files:**
- Create: `apps/web/src/app/shared/ui/klar-icon-button.component.ts`

- [ ] **Step 1: Implement**

```ts
// apps/web/src/app/shared/ui/klar-icon-button.component.ts
import { Component, computed, input } from '@angular/core';
import { KlarIconComponent } from '../icons/klar-icon.component';
import { hlm } from './hlm/hlm-utils';

@Component({
  selector: 'klar-icon-button',
  standalone: true,
  imports: [KlarIconComponent],
  template: `
    <button type="button" [class]="_cls()" [attr.aria-label]="label()">
      <klar-icon [name]="icon()" [size]="iconSize()" />
    </button>
  `,
})
export class KlarIconButtonComponent {
  icon     = input.required<string>();
  label    = input('');
  iconSize = input(16);
  danger   = input(false);

  _cls = computed(() => hlm(
    'inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded',
    'text-muted-foreground transition-colors',
    'hover:bg-accent hover:text-foreground active:opacity-70',
    'disabled:pointer-events-none disabled:opacity-40',
    this.danger() && 'hover:bg-destructive/10 hover:text-destructive',
  ));
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/shared/ui/klar-icon-button.component.ts
git commit -m "feat(ui): add KlarIconButtonComponent (44px touch target)"
```

---

## Task 10: KlarStatCardComponent

Replaces the repeated `.stat-card` blocks in monat.component.html.

**Files:**
- Create: `apps/web/src/app/shared/ui/klar-stat-card.component.ts`

- [ ] **Step 1: Implement**

```ts
// apps/web/src/app/shared/ui/klar-stat-card.component.ts
import { Component, computed, input } from '@angular/core';
import { NgClass } from '@angular/common';
import { KlarMoneyPipe } from '../pipes/klar-money.pipe';

export type StatCardTone = 'income' | 'expense' | 'auto' | 'neutral';

@Component({
  selector: 'klar-stat-card',
  standalone: true,
  imports: [NgClass, KlarMoneyPipe],
  template: `
    <div class="flex flex-col gap-1 rounded border border-border bg-card px-4 py-3">
      <span class="text-[10px] uppercase tracking-widest text-muted-foreground">
        {{ label() }}
      </span>
      <span class="font-mono tabular-nums text-xl font-semibold" [ngClass]="_valueClass()">
        {{ valueCents() | klarMoney }}
      </span>
      @if (sub()) {
        <span class="text-[11px] text-muted-foreground">{{ sub() }}</span>
      }
    </div>
  `,
})
export class KlarStatCardComponent {
  label      = input.required<string>();
  valueCents = input.required<number>();
  sub        = input('');
  tone       = input<StatCardTone>('auto');

  _valueClass = computed(() => {
    switch (this.tone()) {
      case 'income':  return 'text-success';
      case 'expense': return 'text-danger';
      case 'auto':    return this.valueCents() >= 0 ? 'text-success' : 'text-danger';
      default:        return 'text-foreground';
    }
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/shared/ui/klar-stat-card.component.ts
git commit -m "feat(ui): add KlarStatCardComponent"
```

---

## Task 11: KlarSkeletonRowsComponent + KlarSkeletonCardsComponent

**Files:**
- Create: `apps/web/src/app/shared/ui/klar-skeleton-rows.component.ts`
- Create: `apps/web/src/app/shared/ui/klar-skeleton-cards.component.ts`

- [ ] **Step 1: Implement KlarSkeletonRowsComponent** (replaces inline loops in buchungen + fixkosten)

```ts
// apps/web/src/app/shared/ui/klar-skeleton-rows.component.ts
import { Component, computed, input } from '@angular/core';
import { KlarSkeletonComponent } from './klar-skeleton.component';

@Component({
  selector: 'klar-skeleton-rows',
  standalone: true,
  imports: [KlarSkeletonComponent],
  template: `
    @for (_ of _rows(); track $index) {
      <div class="flex items-center gap-3 px-4 py-2">
        <klar-skeleton height="11px" width="36px" />
        <klar-skeleton height="13px" width="55%" />
        <klar-skeleton height="13px" width="70px" class="ml-auto" />
      </div>
    }
  `,
})
export class KlarSkeletonRowsComponent {
  count = input(5);
  _rows = computed(() => Array(this.count()).fill(null));
}
```

- [ ] **Step 2: Implement KlarSkeletonCardsComponent** (replaces inline loops in monat + projekte)

```ts
// apps/web/src/app/shared/ui/klar-skeleton-cards.component.ts
import { Component, computed, input } from '@angular/core';
import { KlarSkeletonComponent } from './klar-skeleton.component';

@Component({
  selector: 'klar-skeleton-cards',
  standalone: true,
  imports: [KlarSkeletonComponent],
  template: `
    @for (_ of _cards(); track $index) {
      <div class="flex flex-col gap-2 rounded border border-border px-4 py-3">
        <klar-skeleton height="9px" width="80px" />
        <klar-skeleton height="28px" width="60%" />
        <klar-skeleton height="11px" width="100%" />
      </div>
    }
  `,
})
export class KlarSkeletonCardsComponent {
  count = input(4);
  _cards = computed(() => Array(this.count()).fill(null));
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/shared/ui/klar-skeleton-rows.component.ts apps/web/src/app/shared/ui/klar-skeleton-cards.component.ts
git commit -m "feat(ui): add KlarSkeletonRowsComponent + KlarSkeletonCardsComponent"
```

---

## Task 12: Migrate buchungen page

**Files:**
- Modify: `apps/web/src/app/pages/buchungen/buchungen.component.ts`
- Modify: `apps/web/src/app/pages/buchungen/buchungen.component.html`

- [ ] **Step 1: Update buchungen.component.ts**

Remove `formatCents()`, `prevMonth()`, `nextMonth()`, `displayMonth` computed. Add imports:

```ts
import { KlarMoneyPipe } from '../../shared/pipes/klar-money.pipe';
import { KlarMoneyClassPipe } from '../../shared/pipes/klar-money-class.pipe';
import { KlarErrorBarComponent } from '../../shared/ui/klar-error-bar.component';
import { KlarEmptyStateComponent } from '../../shared/ui/klar-empty-state.component';
import { KlarMonthPickerComponent } from '../../shared/ui/klar-month-picker.component';
import { KlarSkeletonRowsComponent } from '../../shared/ui/klar-skeleton-rows.component';
```

Remove from `imports` array: `KlarSkeletonComponent`, `KlarIconComponent` (if only used for month-nav).
Add to `imports` array: `KlarMoneyPipe`, `KlarMoneyClassPipe`, `KlarErrorBarComponent`, `KlarEmptyStateComponent`, `KlarMonthPickerComponent`, `KlarSkeletonRowsComponent`, `NgClass`.

Remove these methods from the class:
- `formatCents(cents: number): string { … }`
- `prevMonth(): void { … }`
- `nextMonth(): void { … }`
- `protected readonly displayMonth = computed(…)`

- [ ] **Step 2: Update buchungen.component.html**

Replace month-nav:
```html
<!-- Before -->
<div class="month-nav">
  <button type="button" class="nav-btn" aria-label="Vorheriger Monat" (click)="prevMonth()">
    <klar-icon name="chevron-left" [size]="18"/>
  </button>
  <span class="month-title">{{ displayMonth() }}</span>
  <button type="button" class="nav-btn" aria-label="Nächster Monat" (click)="nextMonth()">
    <klar-icon name="chevron-right" [size]="18"/>
  </button>
</div>

<!-- After -->
<klar-month-picker
  [month]="store.currentMonth()"
  (monthChange)="store.setMonth($event)"
  class="month-nav" />
```

Replace skeleton rows:
```html
<!-- Before -->
@for (_ of [1,2,3,4,5,6]; track $index) {
  <div class="sk-row">
    <klar-skeleton height="11px" width="36px"/>
    <klar-skeleton height="13px" width="55%"/>
    <klar-skeleton height="13px" width="70px"/>
  </div>
}

<!-- After -->
<klar-skeleton-rows [count]="6" />
```

Replace error-bar:
```html
<!-- Before -->
<div class="error-bar">
  <klar-icon name="alert-circle" [size]="14"/>
  <span>Fehler beim Laden der Buchungen.</span>
  <button class="retry-btn" type="button" (click)="store.reload()">Erneut versuchen</button>
</div>

<!-- After -->
<klar-error-bar message="Fehler beim Laden der Buchungen." (retry)="store.reload()" />
```

Replace empty-state:
```html
<!-- Before -->
<div class="empty-state">
  <klar-icon name="inbox" [size]="36" [stroke]="1.25"/>
  <p>Noch keine Buchungen für diesen Monat</p>
</div>

<!-- After -->
<klar-empty-state message="Noch keine Buchungen für diesen Monat" />
```

Replace `formatCents(x)` → `x | klarMoney` and `[class.income]="x > 0" [class.expense]="x < 0"` → `[ngClass]="x | klarMoneyClass"`.

- [ ] **Step 3: Verify no TypeScript errors** (`Ctrl+Shift+M` / run `pnpm --filter web build`)

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/pages/buchungen/
git commit -m "refactor(buchungen): migrate to reusable UI controls"
```

---

## Task 13: Migrate fixkosten page

**Files:**
- Modify: `apps/web/src/app/pages/fixkosten/fixkosten.component.ts`
- Modify: `apps/web/src/app/pages/fixkosten/fixkosten.component.html`

- [ ] **Step 1: Update fixkosten.component.ts**

Remove `formatCents()`. Add imports:
```ts
import { NgClass } from '@angular/common';
import { KlarMoneyPipe } from '../../shared/pipes/klar-money.pipe';
import { KlarMoneyClassPipe } from '../../shared/pipes/klar-money-class.pipe';
import { KlarErrorBarComponent } from '../../shared/ui/klar-error-bar.component';
import { KlarEmptyStateComponent } from '../../shared/ui/klar-empty-state.component';
```

- [ ] **Step 2: Update fixkosten.component.html**

Replace error-bar and empty-state (same as Task 12 pattern).
Replace all `formatCents(x)` → `x | klarMoney`.
Replace `[class.income]="x > 0" [class.expense]="x < 0"` → `[ngClass]="x | klarMoneyClass"`.

- [ ] **Step 3: Verify + Commit**

```bash
git add apps/web/src/app/pages/fixkosten/
git commit -m "refactor(fixkosten): migrate to reusable UI controls"
```

---

## Task 14: Migrate monat page

**Files:**
- Modify: `apps/web/src/app/pages/monat/monat.component.ts`
- Modify: `apps/web/src/app/pages/monat/monat.component.html`

- [ ] **Step 1: Update monat.component.ts**

Remove `formatCents()`, `prevMonth()`, `nextMonth()`, `displayMonth` computed. Add imports:
```ts
import { NgClass } from '@angular/common';
import { KlarMoneyPipe } from '../../shared/pipes/klar-money.pipe';
import { KlarMoneyClassPipe } from '../../shared/pipes/klar-money-class.pipe';
import { KlarErrorBarComponent } from '../../shared/ui/klar-error-bar.component';
import { KlarEmptyStateComponent } from '../../shared/ui/klar-empty-state.component';
import { KlarMonthPickerComponent } from '../../shared/ui/klar-month-picker.component';
import { KlarStatCardComponent } from '../../shared/ui/klar-stat-card.component';
import { KlarSkeletonCardsComponent } from '../../shared/ui/klar-skeleton-cards.component';
```

- [ ] **Step 2: Update monat.component.html**

Replace month-nav (same as Task 12).
Replace skeleton cards:
```html
<!-- Before -->
<div class="stat-grid loading-grid">
  @for (_ of [1,2,3,4]; track $index) {
    <div class="stat-card sk-card">
      <klar-skeleton height="9px" width="80px"/>
      <klar-skeleton class="sk-gap-8" height="28px" width="60%"/>
      <klar-skeleton class="sk-gap-6" height="11px" width="100%"/>
    </div>
  }
</div>

<!-- After -->
<div class="stat-grid">
  <klar-skeleton-cards [count]="4" />
</div>
```

Replace error-bar + empty-state (same pattern as Task 12).
Replace `.stat-card` blocks with `<klar-stat-card>`:
```html
<!-- Before -->
<div class="stat-card income-card">
  <span class="stat-label">EINGEGANGEN</span>
  <span class="stat-value income">{{ formatCents(store.cashflow()!.totalIncomeCents) }}</span>
  <span class="stat-sub">Einnahmen dieses Monats</span>
</div>

<!-- After -->
<klar-stat-card
  label="EINGEGANGEN"
  [valueCents]="store.cashflow()!.totalIncomeCents"
  sub="Einnahmen dieses Monats"
  tone="income" />
```

Repeat for all 4 stat cards with appropriate tone: `income`, `expense`, `auto` (for surplus), `expense` (for Fixkosten).

Replace `formatCents(x)` → `x | klarMoney` in breakdown section.
Replace `[class.income]`/`[class.expense]` bindings → `[ngClass]="x | klarMoneyClass"`.

- [ ] **Step 3: Verify + Commit**

```bash
git add apps/web/src/app/pages/monat/
git commit -m "refactor(monat): migrate to reusable UI controls"
```

---

## Task 15: Migrate projekte page

**Files:**
- Modify: `apps/web/src/app/pages/projekte/projekte.component.ts`
- Modify: `apps/web/src/app/pages/projekte/projekte.component.html`

- [ ] **Step 1: Update projekte.component.ts**

Remove `formatCents()`. Add imports:
```ts
import { NgClass } from '@angular/common';
import { KlarMoneyPipe } from '../../shared/pipes/klar-money.pipe';
import { KlarMoneyClassPipe } from '../../shared/pipes/klar-money-class.pipe';
import { KlarErrorBarComponent } from '../../shared/ui/klar-error-bar.component';
import { KlarEmptyStateComponent } from '../../shared/ui/klar-empty-state.component';
```

- [ ] **Step 2: Update projekte.component.html** — same pattern replacements as Tasks 12–14.

- [ ] **Step 3: Verify + Commit**

```bash
git add apps/web/src/app/pages/projekte/
git commit -m "refactor(projekte): migrate to reusable UI controls"
```

---

## Task 16: Migrate auth pages (login, register, onboarding) — HlmLoadingBtnDirective

For each auth page that has a loading button pattern like:
```html
<button hlmBtn [disabled]="loading()">
  @if (loading()) { <hlm-spinner [size]="12" /> }
  Anmelden
</button>
```

Add `HlmLoadingBtnDirective` to the imports array and replace `[disabled]="loading()"` with `[klarLoadingBtn]="loading()"`.

**Files:**
- Modify: `apps/web/src/app/pages/login/login.component.ts`
- Modify: `apps/web/src/app/pages/login/login.component.html`
- Modify: `apps/web/src/app/pages/register/register.component.ts`
- Modify: `apps/web/src/app/pages/register/register.component.html`
- Modify: `apps/web/src/app/pages/onboarding/onboarding.component.ts`
- Modify: `apps/web/src/app/pages/onboarding/onboarding.component.html`

- [ ] **Step 1: For each page, add to imports array**

```ts
import { HlmLoadingBtnDirective } from '../../shared/ui/hlm/hlm-loading-btn.directive';
```

- [ ] **Step 2: For each page template, replace pattern**

```html
<!-- Before -->
<button hlmBtn [disabled]="loading()">
  @if (loading()) { <hlm-spinner [size]="12" /> }
  Anmelden
</button>

<!-- After -->
<button hlmBtn [klarLoadingBtn]="loading()">
  @if (loading()) { <hlm-spinner [size]="12" /> }
  Anmelden
</button>
```

- [ ] **Step 3: Verify + Commit**

```bash
git add apps/web/src/app/pages/login/ apps/web/src/app/pages/register/ apps/web/src/app/pages/onboarding/
git commit -m "refactor(auth): use HlmLoadingBtnDirective on submit buttons"
```

---

## Task 17: Final verification

- [ ] **Step 1: Full build**
```
pnpm build
```
Expected: no TypeScript errors, no compilation failures.

- [ ] **Step 2: Full test suite**
```
pnpm test
```
Expected: all tests pass including KlarMoneyPipe + KlarMoneyClassPipe unit tests.

- [ ] **Step 3: Update CLAUDE.md** — add new controls to "Verfügbare hlm-Wrapper" section

Add to the `hlm-wrapper` list in CLAUDE.md:
```
- `| klarMoney` auf number — KlarMoneyPipe (formatCents Ersatz)
- `| klarMoneyClass` auf number — KlarMoneyClassPipe (text-success/text-danger)
- `<klar-error-bar>` — Fehlerbalken mit Retry-Button
- `<klar-empty-state>` — Leer-Zustand mit Icon + Text
- `<klar-month-picker>` — Monat-Navigation Prev/Current/Next
- `<klar-form-field>` — Label + Input + Error Wrapper
- `<klar-section-header>` — Abschnitts-Titel mit optionalem Action-Slot
- `<klar-icon-button>` — Icon-only Button mit 44px Touch-Target
- `<klar-stat-card>` — Label + Geldbetrag + Sub-Label Kachel
- `<klar-skeleton-rows>` — N Skeleton-Zeilen (3-spaltig)
- `<klar-skeleton-cards>` — N Skeleton-Karten (Label/Wert/Sub)
- `[klarLoadingBtn]` auf `button[hlmBtn]` — HlmLoadingBtnDirective
```

- [ ] **Step 4: Commit**
```bash
git add CLAUDE.md
git commit -m "docs(claude): document new reusable UI controls"
```

---

## Execution Notes

**Ruflo Swarm:** Tasks 1–11 (control creation) are fully independent and can run in parallel across 6 agents:
- Agent A: Tasks 1+2 (pipes)
- Agent B: Tasks 3+4 (error-bar + empty-state)
- Agent C: Task 5 (month-picker)
- Agent D: Tasks 6+7 (loading-btn + form-field)
- Agent E: Tasks 8+9 (section-header + icon-button)
- Agent F: Tasks 10+11 (stat-card + skeleton variants)

Tasks 12–16 (migrations) depend on controls being complete. Run sequentially or in parallel per-page after Agent A–F finish.
