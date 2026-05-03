# App Overhaul — Zero Chrome Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the Zero Chrome overhaul across all 7 pages — eliminate stat strips, move key metrics into the topbar, reduce all data rows to 26px, and converge on a single density.

**Architecture:** Extend `PageHeaderService` with a reactive `stats` signal and `chipLabel` signal that pages drive via `effect()`. `TopBarComponent` reads and renders these signals. Each page's template is rewritten in-place; CSS files are gutted in favour of Tailwind utilities.

**Tech Stack:** Angular 21 (zoneless, signals), Tailwind 4, component-scoped CSS files minimized to zero or near-zero.

**Spec:** `docs/superpowers/specs/2026-05-03-app-overhaul-design.md`

> **Note on TDD:** All changes in this plan are pure visual/layout — no logic changes, no new data paths. The verification step for each task is a TypeScript compile check (`pnpm --filter web exec tsc --noEmit`) confirming zero type errors. UI correctness is verified by running the dev server and inspecting the affected page.

---

## File Map

| Task | Files |
|------|-------|
| 1 | `apps/web/src/styles.css`, `…/page-header/page-header.service.ts`, `…/top-bar/top-bar.component.ts`, `…/top-bar/top-bar.component.html`, `…/shell/shell.component.html` |
| 2 | `…/fixkosten/fixkosten.component.ts`, `…/fixkosten/fixkosten.component.html`, `…/fixkosten/fixkosten.component.css` |
| 3 | `…/monat/monat.component.ts`, `…/monat/monat.component.html`, `…/monat/monat.component.css` |
| 4 | `…/buchungen/buchungen.component.ts`, `…/buchungen/buchungen.component.html`, `…/buchungen/buchungen.component.css` |
| 5 | `…/projekte/projekte.component.ts`, `…/projekte/projekte.component.html`, `…/projekte/projekte.component.css` |
| 6 | `…/planspiel/planspiel.component.ts`, `…/planspiel/planspiel.component.html`, `…/planspiel/planspiel.component.css` |
| 7 | `…/settings/settings.component.html`, `…/settings/settings.component.css` |
| 8 | `…/haushalt/haushalt.component.html`, `…/haushalt/haushalt.component.css` |

Path prefix for all frontend files: `apps/web/src/app/`

---

## Task 1: Foundation — Row height + TopBar stats infrastructure

**Files:**
- Modify: `apps/web/src/styles.css` (line 75)
- Modify: `apps/web/src/app/core/page-header/page-header.service.ts`
- Modify: `apps/web/src/app/layout/top-bar/top-bar.component.ts`
- Modify: `apps/web/src/app/layout/top-bar/top-bar.component.html`
- Modify: `apps/web/src/app/layout/shell/shell.component.html`

- [ ] **Step 1.1: Update `--spacing-table-row` to 26px**

In `apps/web/src/styles.css`, find line 75:
```css
--spacing-table-row: 35px;
```
Change to:
```css
--spacing-table-row: 26px;
```

- [ ] **Step 1.2: Add `PageStat` interface, `stats` signal, and `chipLabel` signal to `PageHeaderService`**

Replace the entire content of `apps/web/src/app/core/page-header/page-header.service.ts`:

```ts
import { Injectable, signal } from '@angular/core';

export interface PageStat {
  label: string;
  valueCents: number;
  tone: 'surplus' | 'income' | 'expense' | 'neutral';
}

export interface PageHeaderConfig {
  title:          string;
  subtitle?:      string;
  showAdd?:       boolean;
  showPlanspiel?: boolean;
  addLabel?:      string;
  onAdd?:         () => void;
  onPlanspiel?:   () => void;
}

@Injectable({ providedIn: 'root' })
export class PageHeaderService {
  readonly title         = signal('');
  readonly subtitle      = signal<string | undefined>(undefined);
  readonly showAdd       = signal(false);
  readonly showPlanspiel = signal(false);
  readonly addLabel      = signal('Buchung');
  readonly onAdd         = signal<(() => void) | null>(null);
  readonly onPlanspiel   = signal<(() => void) | null>(null);
  readonly stats         = signal<PageStat[]>([]);
  readonly chipLabel     = signal<string | null>(null);

  set(config: PageHeaderConfig): void {
    this.title.set(config.title);
    this.subtitle.set(config.subtitle);
    this.showAdd.set(config.showAdd ?? false);
    this.showPlanspiel.set(config.showPlanspiel ?? false);
    this.addLabel.set(config.addLabel ?? 'Buchung');
    this.onAdd.set(config.onAdd ?? null);
    this.onPlanspiel.set(config.onPlanspiel ?? null);
    this.stats.set([]);
    this.chipLabel.set(null);
  }
}
```

- [ ] **Step 1.3: Update `TopBarComponent` to accept `stats` input and add `statColor()` helper**

Replace the entire content of `apps/web/src/app/layout/top-bar/top-bar.component.ts`:

```ts
import { Component, input, output } from '@angular/core';
import { NgClass } from '@angular/common';
import { HlmButtonDirective } from '../../shared/ui/hlm/hlm-button.directive';
import { KlarIconComponent } from '../../shared/icons/klar-icon.component';
import { KlarMonthChipComponent } from '../../shared/ui/klar-month-chip.component';
import { KlarHeaderUserComponent } from '../../shared/ui/klar-header-user.component';
import { KlarMoneyPipe } from '../../shared/pipes/klar-money.pipe';
import type { PageStat } from '../../core/page-header/page-header.service';

@Component({
  selector: 'klar-top-bar',
  standalone: true,
  host: { class: 'block w-full' },
  imports: [NgClass, KlarMonthChipComponent, KlarIconComponent, HlmButtonDirective, KlarHeaderUserComponent, KlarMoneyPipe],
  templateUrl: './top-bar.component.html',
  styleUrl: './top-bar.component.css',
})
export class TopBarComponent {
  title         = input('');
  subtitle      = input<string>();
  monthChip     = input('April 2026');
  showPlanspiel = input(false);
  showAdd       = input(false);
  addLabel      = input('Buchung');
  stats         = input<PageStat[]>([]);

  addClick       = output<void>();
  planspielClick = output<void>();

  statColor(tone: PageStat['tone']): string {
    switch (tone) {
      case 'income':  return 'text-(--color-income)';
      case 'expense': return 'text-(--color-expense)';
      case 'surplus': return 'text-(--color-surplus)';
      case 'neutral': return 'text-(--text-muted)';
    }
  }
}
```

- [ ] **Step 1.4: Update `top-bar.component.html` to render stats before the month chip**

Replace the entire content of `apps/web/src/app/layout/top-bar/top-bar.component.html`:

```html
<header class="w-full h-13 border-b border-(--border) px-5 flex items-center justify-between shrink-0">
  <div class="flex items-baseline gap-3">
    <span class="text-sm font-medium tracking-[-0.01em]">{{ title() }}</span>
    @if (subtitle()) {
      <span class="text-(--text-muted) klar-label">{{ subtitle() }}</span>
    }
  </div>

  <div class="flex items-center gap-3">
    @for (stat of stats(); track stat.label) {
      <div class="flex flex-col items-end gap-0.5">
        <span class="text-[8px] uppercase tracking-[0.1em] text-(--text-muted) font-medium leading-none">
          {{ stat.label }}
        </span>
        <span class="text-[11px] font-mono tabular-nums leading-none" [ngClass]="statColor(stat.tone)">
          {{ stat.valueCents | klarMoney }}
        </span>
      </div>
    }
    <klar-month-chip [label]="monthChip()" />
    @if (showPlanspiel()) {
      <button hlmBtn variant="ghost" size="sm" type="button" (click)="planspielClick.emit()">
        <klar-icon name="planspiel" [size]="14" />
        Planspiel
      </button>
    }
    @if (showAdd()) {
      <button hlmBtn variant="default" size="sm" type="button" (click)="addClick.emit()">
        <klar-icon name="plus" [size]="14" />
        {{ addLabel() }}
      </button>
    }
    <klar-header-user />
  </div>
</header>
```

- [ ] **Step 1.5: Update `shell.component.html` — pass `stats` and wire `chipLabel` to the month chip**

In `apps/web/src/app/layout/shell/shell.component.html`, find the `<klar-top-bar>` block:

```html
      <klar-top-bar
        class="hidden md:flex"
        [title]="pageHeader.title()"
        [subtitle]="pageHeader.subtitle() ?? ''"
        [monthChip]="monthChip()"
        [showPlanspiel]="pageHeader.showPlanspiel()"
        [showAdd]="pageHeader.showAdd()"
        [addLabel]="pageHeader.addLabel()"
        (addClick)="pageHeader.onAdd()?.()"
        (planspielClick)="pageHeader.onPlanspiel()?.()"
      />
```

Replace with:

```html
      <klar-top-bar
        class="hidden md:flex"
        [title]="pageHeader.title()"
        [subtitle]="pageHeader.subtitle() ?? ''"
        [monthChip]="pageHeader.chipLabel() ?? monthChip()"
        [showPlanspiel]="pageHeader.showPlanspiel()"
        [showAdd]="pageHeader.showAdd()"
        [addLabel]="pageHeader.addLabel()"
        [stats]="pageHeader.stats()"
        (addClick)="pageHeader.onAdd()?.()"
        (planspielClick)="pageHeader.onPlanspiel()?.()"
      />
```

- [ ] **Step 1.6: Verify — TypeScript compile check**

Run:
```bash
pnpm --filter web exec tsc --noEmit
```
Expected: No errors.

- [ ] **Step 1.7: Commit**

```bash
git add apps/web/src/styles.css apps/web/src/app/core/page-header/page-header.service.ts apps/web/src/app/layout/top-bar/top-bar.component.ts apps/web/src/app/layout/top-bar/top-bar.component.html apps/web/src/app/layout/shell/shell.component.html
git commit -m "feat(ui): add stats/chipLabel signals to PageHeaderService and TopBar"
```

---

## Task 2: Fixkosten — Remove stat strip, redesign group headers and rows

**Files:**
- Modify: `apps/web/src/app/pages/fixkosten/fixkosten.component.ts`
- Modify: `apps/web/src/app/pages/fixkosten/fixkosten.component.html`
- Modify: `apps/web/src/app/pages/fixkosten/fixkosten.component.css`

- [ ] **Step 2.1: Update `fixkosten.component.ts` — remove BrandIconComponent, add pageHeader field, reactive stats effect, shortFreq() method**

Replace the entire content of `apps/web/src/app/pages/fixkosten/fixkosten.component.ts`:

```ts
import { Component, computed, effect, inject, signal } from '@angular/core';
import { LowerCasePipe, NgClass } from '@angular/common';
import { Router } from '@angular/router';
import { KlarSkeletonComponent } from '../../shared/ui/klar-skeleton.component';
import { KlarIconComponent } from '../../shared/icons/klar-icon.component';
import { KlarDialogService } from '../../shared/ui/klar-dialog.service';
import { OverviewStore } from '../../core/overview/overview.store';
import { PageHeaderService } from '../../core/page-header/page-header.service';
import { RecurringEditDialogComponent } from './recurring-edit-dialog.component';
import { KlarMoneyPipe } from '../../shared/pipes/klar-money.pipe';
import { KlarMoneyClassPipe } from '../../shared/pipes/klar-money-class.pipe';
import { KlarErrorBarComponent } from '../../shared/ui/klar-error-bar.component';
import { KlarEmptyStateComponent } from '../../shared/ui/klar-empty-state.component';
import type { FixedCostItem } from '../../core/overview/overview.service';
import type { RecurringFrequency } from '@klar/shared';

@Component({
  selector: 'app-fixkosten',
  standalone: true,
  host: { class: 'flex flex-col flex-1 min-h-0 overflow-hidden' },
  imports: [LowerCasePipe, NgClass, KlarSkeletonComponent, KlarIconComponent, KlarMoneyPipe, KlarMoneyClassPipe, KlarErrorBarComponent, KlarEmptyStateComponent],
  templateUrl: './fixkosten.component.html',
  styleUrl: './fixkosten.component.css',
})
export class FixkostenPageComponent {
  protected store       = inject(OverviewStore);
  private pageHeader    = inject(PageHeaderService);
  private dialogService = inject(KlarDialogService);

  constructor() {
    const router = inject(Router);
    this.pageHeader.set({
      title:         'Fixkosten',
      showPlanspiel: true,
      showAdd:       true,
      addLabel:      'Buchung',
      onPlanspiel:   () => router.navigate(['/app/planspiel']),
      onAdd:         () => router.navigate(['/app/buchungen']),
    });

    effect(() => {
      const surplus = this.surplusCents();
      this.pageHeader.stats.set([{
        label:      'Überschuss',
        valueCents: surplus,
        tone:       surplus >= 0 ? 'surplus' : 'expense',
      }]);
    });
  }

  // ── Collapse state ───────────────────────────────────────────────────────────

  readonly collapsedGroups = signal(new Set<string>());

  toggleGroup(categoryId: string): void {
    this.collapsedGroups.update(set => {
      const next = new Set(set);
      next.has(categoryId) ? next.delete(categoryId) : next.add(categoryId);
      return next;
    });
  }

  isCollapsed(categoryId: string): boolean {
    return this.collapsedGroups().has(categoryId);
  }

  // ── Edit via dialog ──────────────────────────────────────────────────────────

  openEdit(item: FixedCostItem, event: Event): void {
    event.stopPropagation();
    this.dialogService.open({
      title:     'Eintrag bearbeiten',
      component: RecurringEditDialogComponent,
      inputs:    { item },
      width:     'sm',
    });
  }

  // ── Enriched groups ──────────────────────────────────────────────────────────

  readonly enrichedGroups = computed(() => this.store.fixedCosts()?.groups ?? []);

  // ── Summary computed ─────────────────────────────────────────────────────────

  readonly incomeTotalCents = computed(() =>
    this.enrichedGroups().filter(g => g.totalCents > 0).reduce((s, g) => s + g.totalCents, 0)
  );

  readonly expenseTotalCents = computed(() =>
    this.enrichedGroups().filter(g => g.totalCents < 0).reduce((s, g) => s + g.totalCents, 0)
  );

  readonly surplusCents = computed(() => this.incomeTotalCents() + this.expenseTotalCents());

  // ── Formatting helpers ───────────────────────────────────────────────────────

  formatDay(day: number | null): string {
    if (!day) return '';
    return String(day).padStart(2, '0') + '.';
  }

  shortFreq(freq: RecurringFrequency): string {
    switch (freq) {
      case 'QUARTERLY':   return '/ Quartal';
      case 'YEARLY':      return '/ Jahr';
      case 'CUSTOM_DAYS': return '/ individuell';
      default:            return '';
    }
  }
}
```

- [ ] **Step 2.2: Rewrite `fixkosten.component.html` — remove stat strip, sub-header, brand icon; redesign group headers and rows**

Replace the entire content of `apps/web/src/app/pages/fixkosten/fixkosten.component.html`:

```html
<!-- Loading skeleton -->
@if (store.loading()) {
  <div class="flex flex-col overflow-y-auto">
    @for (_ of [1,2,3]; track $index) {
      <div class="flex items-center h-[26px] px-4 gap-2 border-l-2 border-(--border)">
        <klar-skeleton height="9px" width="120px" />
        <div class="flex-1"></div>
        <klar-skeleton height="11px" width="80px" />
      </div>
      @for (__ of [1,2,3]; track $index) {
        <div class="flex items-center h-[26px] px-4 gap-2">
          <klar-skeleton height="11px" width="55%" />
          <div class="flex-1"></div>
          <klar-skeleton height="11px" width="68px" />
        </div>
      }
    }
  </div>
}

<!-- Error -->
@else if (store.error()) {
  <klar-error-bar message="Fehler beim Laden der Fixkosten." (retry)="store.reload()" />
}

<!-- Empty -->
@else if (!store.fixedCosts() || store.fixedCosts()!.groups.length === 0) {
  <klar-empty-state message="Keine Fixkosten für diesen Monat" />
}

<!-- Ledger -->
@else {
  <div class="flex flex-col overflow-y-auto">
    @for (group of enrichedGroups(); track group.categoryId) {

      <!-- Group header: 2px left border (category color), 5px dot, name, total, chevron -->
      <div class="flex items-center h-[26px] px-4 gap-2 border-l-2 cursor-pointer
                  hover:bg-(--surface-2) transition-colors duration-100"
           [style.border-left-color]="group.categoryColor"
           (click)="toggleGroup(group.categoryId)">
        <span class="w-[5px] h-[5px] rounded-full shrink-0"
              [style.background]="group.categoryColor"></span>
        <span class="text-[9px] uppercase tracking-[0.1em] font-medium text-(--text-muted) flex-1 leading-none">
          {{ group.categoryName }}
        </span>
        <span class="font-mono tabular-nums text-[11px]" [ngClass]="group.totalCents | klarMoneyClass">
          {{ group.totalCents | klarMoney }}
        </span>
        <klar-icon name="chevron-down" [size]="10"
                   class="text-(--text-muted) transition-transform duration-150 shrink-0"
                   [class.-rotate-90]="isCollapsed(group.categoryId)" />
      </div>

      <!-- Individual rows: 26px, no border, name + shortFreq + day + amount -->
      @if (!isCollapsed(group.categoryId)) {
        @for (item of group.items; track item.id) {
          <div class="flex items-center h-[26px] px-4 gap-2 cursor-pointer
                      hover:bg-(--surface-2) transition-colors duration-100"
               (click)="openEdit(item, $event)">
            <span class="flex-1 text-[13px] text-(--text) truncate leading-none min-w-0">
              {{ item.name }}
            </span>
            @if (item.frequency !== 'MONTHLY') {
              <span class="text-[9px] text-(--text-muted) shrink-0 leading-none">
                {{ shortFreq(item.frequency) }}
              </span>
            }
            <span class="text-[9px] font-mono text-(--text-muted) w-[22px] text-right shrink-0 tabular-nums leading-none">
              {{ formatDay(item.dayOfMonth) }}
            </span>
            <span class="font-mono tabular-nums text-[11px] w-[68px] text-right shrink-0 leading-none"
                  [ngClass]="item.monthlyEquivalentCents | klarMoneyClass">
              {{ item.monthlyEquivalentCents | klarMoney }}
            </span>
          </div>
        }
      }

    }
  </div>
}
```

- [ ] **Step 2.3: Empty the `fixkosten.component.css` file — all layout is now Tailwind**

Replace the entire content of `apps/web/src/app/pages/fixkosten/fixkosten.component.css` with an empty string (delete all rules). The file can be empty.

- [ ] **Step 2.4: TypeScript compile check**

```bash
pnpm --filter web exec tsc --noEmit
```
Expected: No errors.

- [ ] **Step 2.5: Commit**

```bash
git add apps/web/src/app/pages/fixkosten/
git commit -m "feat(fixkosten): zero chrome — remove stat strip, 26px rows, inline freq suffix"
```

---

## Task 3: Monat — Remove 4 stat cards, add inline stat row

**Files:**
- Modify: `apps/web/src/app/pages/monat/monat.component.ts`
- Modify: `apps/web/src/app/pages/monat/monat.component.html`
- Modify: `apps/web/src/app/pages/monat/monat.component.css`

- [ ] **Step 3.1: Update `monat.component.ts` — remove deprecated imports, add pageHeader field, reactive surplus effect**

Replace the entire content of `apps/web/src/app/pages/monat/monat.component.ts`:

```ts
import { Component, computed, effect, inject, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { Router } from '@angular/router';
import { KlarMoneyPipe } from '../../shared/pipes/klar-money.pipe';
import { KlarMoneyClassPipe } from '../../shared/pipes/klar-money-class.pipe';
import { KlarErrorBarComponent } from '../../shared/ui/klar-error-bar.component';
import { KlarEmptyStateComponent } from '../../shared/ui/klar-empty-state.component';
import { HlmCalendarComponent, type CalendarEvent, type CalendarEventMap } from '../../shared/ui/hlm/hlm-calendar.component';
import { OverviewStore } from '../../core/overview/overview.store';
import { TransactionsStore } from '../../core/transactions/transactions.store';
import { PageHeaderService } from '../../core/page-header/page-header.service';

@Component({
  selector: 'app-monat',
  standalone: true,
  host: { class: 'flex flex-col flex-1 min-h-0 overflow-hidden' },
  imports: [
    NgClass,
    KlarMoneyPipe,
    KlarMoneyClassPipe,
    KlarErrorBarComponent,
    KlarEmptyStateComponent,
    HlmCalendarComponent,
  ],
  templateUrl: './monat.component.html',
  styleUrl: './monat.component.css',
})
export class MonatPageComponent {
  protected store  = inject(OverviewStore);
  private txStore  = inject(TransactionsStore);
  private pageHeader = inject(PageHeaderService);

  protected readonly sheetDay = signal<{ date: Date; events: CalendarEvent[] } | null>(null);

  protected readonly sheetDayLabel = computed(() => {
    const sd = this.sheetDay();
    if (!sd) return '';
    return new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'long' }).format(sd.date);
  });

  protected readonly sumAmounts = (acc: number, ev: CalendarEvent) => acc + ev.amountCents;

  constructor() {
    const router = inject(Router);
    this.pageHeader.set({
      title:         'Monatsansicht',
      showPlanspiel: true,
      showAdd:       true,
      addLabel:      'Buchung',
      onPlanspiel:   () => router.navigate(['/app/planspiel']),
      onAdd:         () => router.navigate(['/app/buchungen']),
    });

    effect(() => { this.txStore.setMonth(this.store.currentMonth()); });

    effect(() => {
      const cf = this.store.cashflow();
      if (!cf) return;
      this.pageHeader.stats.set([{
        label:      'Überschuss',
        valueCents: cf.surplusCents,
        tone:       cf.surplusCents >= 0 ? 'surplus' : 'expense',
      }]);
    });
  }

  protected navigateMonth(month: string): void {
    this.store.setMonth(month);
  }

  protected onDayTap(payload: { date: Date; events: CalendarEvent[] }): void {
    if (window.innerWidth < 768) {
      this.sheetDay.set(payload);
    }
  }

  protected readonly surplusPositive = computed(() => {
    const cf = this.store.cashflow();
    return cf ? cf.surplusCents >= 0 : false;
  });

  protected readonly statusDate = computed(() => {
    const [year, month] = this.store.currentMonth().split('-');
    const now = new Date();
    if (now.getFullYear() === Number(year) && now.getMonth() + 1 === Number(month)) {
      const dd = String(now.getDate()).padStart(2, '0');
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const hh = String(now.getHours()).padStart(2, '0');
      const min = String(now.getMinutes()).padStart(2, '0');
      return `STAND ${dd}.${mm}. — ${hh}:${min}`;
    }
    return new Date(Number(year), Number(month) - 1, 1)
      .toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })
      .toUpperCase();
  });

  protected readonly isCurrentMonth = computed(() => {
    const [year, month] = this.store.currentMonth().split('-');
    const now = new Date();
    return now.getFullYear() === Number(year) && now.getMonth() + 1 === Number(month);
  });

  protected readonly calendarEvents = computed<CalendarEventMap>(() => {
    const fc = this.store.fixedCosts();
    const transactions = this.txStore.items() ?? [];
    const [yearStr, monthStr] = this.store.currentMonth().split('-');
    const year  = Number(yearStr);
    const month = Number(monthStr);
    const maxDay = new Date(year, month, 0).getDate();

    const map: CalendarEventMap = {};

    const push = (day: number, event: CalendarEventMap[number][number]) => {
      (map[day] ??= []).push(event);
    };

    if (fc) {
      for (const group of fc.groups) {
        for (const item of group.items) {
          if (item.dayOfMonth !== null) {
            const day = Math.min(item.dayOfMonth, maxDay);
            push(day, {
              name:        item.name,
              amountCents: item.monthlyEquivalentCents,
              color:       group.categoryColor,
              isRecurring: true,
            });
          }
        }
      }
    }

    for (const tx of transactions) {
      const day = new Date(tx.date).getDate();
      push(day, {
        name:        tx.description || 'Buchung',
        amountCents: tx.amountCents,
        color:       tx.amountCents >= 0 ? 'var(--color-income)' : 'var(--color-expense)',
        isRecurring: false,
      });
    }

    for (const day of Object.keys(map)) {
      map[Number(day)].sort((a, b) => {
        if (a.isRecurring !== b.isRecurring) return a.isRecurring ? -1 : 1;
        return Math.abs(b.amountCents) - Math.abs(a.amountCents);
      });
    }

    return map;
  });
}
```

- [ ] **Step 3.2: Update `monat.component.html` — replace 4 stat cards with 4-column inline stat row; tighten breakdown rows**

Replace the entire content of `apps/web/src/app/pages/monat/monat.component.html`:

```html
<div class="flex flex-col flex-1 min-h-0 overflow-y-auto">

  <!-- Calendar scheduler -->
  <hlm-calendar
    class="cal-nav-block h-[75dvh] shrink-0"
    [month]="store.currentMonth()"
    [events]="calendarEvents()"
    (monthChange)="navigateMonth($event)"
    (dayTap)="onDayTap($event)" />

  <!-- Loading -->
  @if (store.loading()) {
    <div class="grid grid-cols-4 border-t border-(--border) divide-x divide-(--border)">
      @for (_ of [1,2,3,4]; track $index) {
        <div class="flex flex-col items-center py-2.5 gap-1">
          <div class="h-[8px] w-16 bg-(--surface-2) rounded animate-pulse"></div>
          <div class="h-[11px] w-20 bg-(--surface-2) rounded animate-pulse mt-1"></div>
        </div>
      }
    </div>
  }

  <!-- Error -->
  @else if (store.error()) {
    <klar-error-bar message="Fehler beim Laden der Übersicht." (retry)="store.reload()" />
  }

  <!-- Empty -->
  @else if (!store.cashflow()) {
    <klar-empty-state message="Noch keine Daten für diesen Monat" />
  }

  <!-- Data -->
  @else {

    <!-- Mobile Hero Surplus — unchanged -->
    <div class="mobile-hero">
      <div class="hero-label">
        {{ surplusPositive() ? 'ÜBERSCHUSS' : 'DEFIZIT' }}
        @if (isCurrentMonth()) { <span class="hero-stand">· {{ statusDate() }}</span> }
      </div>
      <div class="hero-amount" [ngClass]="store.cashflow()!.surplusCents | klarMoneyClass">
        {{ store.cashflow()!.surplusCents | klarMoney }}
      </div>
      <div class="hero-sub">
        <span class="income">+{{ store.cashflow()!.totalIncomeCents | klarMoney }}</span>
        <span class="hero-arrow">→</span>
        <span class="expense">{{ store.cashflow()!.totalExpensesCents | klarMoney }}</span>
      </div>
    </div>

    <!-- 4-column inline stat row (replaces 4 stat cards) -->
    <div class="grid grid-cols-4 border-t border-b border-(--border) divide-x divide-(--border) shrink-0">
      <div class="flex flex-col items-center py-2.5 gap-1">
        <span class="text-[8px] uppercase tracking-[0.1em] text-(--text-muted) font-medium leading-none">
          EINGEGANGEN
        </span>
        <span class="font-mono tabular-nums text-[11px] text-(--color-income) leading-none">
          {{ store.cashflow()!.totalIncomeCents | klarMoney }}
        </span>
      </div>
      <div class="flex flex-col items-center py-2.5 gap-1">
        <span class="text-[8px] uppercase tracking-[0.1em] text-(--text-muted) font-medium leading-none">
          AUSGEGEBEN
        </span>
        <span class="font-mono tabular-nums text-[11px] text-(--color-expense) leading-none">
          {{ store.cashflow()!.totalExpensesCents | klarMoney }}
        </span>
      </div>
      <div class="flex flex-col items-center py-2.5 gap-1">
        <span class="text-[8px] uppercase tracking-[0.1em] text-(--text-muted) font-medium leading-none">
          FIXKOSTEN
        </span>
        <span class="font-mono tabular-nums text-[11px] text-(--color-expense) leading-none">
          {{ store.cashflow()!.recurringExpensesCents | klarMoney }}
        </span>
      </div>
      <div class="flex flex-col items-center py-2.5 gap-1">
        <span class="text-[8px] uppercase tracking-[0.1em] text-(--text-muted) font-medium leading-none">
          VARIABEL
        </span>
        <span class="font-mono tabular-nums text-[11px] leading-none"
              [ngClass]="store.cashflow()!.surplusCents | klarMoneyClass">
          {{ store.cashflow()!.surplusCents | klarMoney }}
        </span>
      </div>
    </div>

    <!-- Breakdown: income vs expenses — rows tightened to 26px -->
    <div class="flex flex-col shrink-0">

      <div class="flex flex-col">
        <div class="flex items-center h-[26px] px-4 gap-2 border-b border-(--border)">
          <span class="text-[9px] uppercase tracking-[0.1em] text-(--text-muted) font-medium flex-1 leading-none">
            EINNAHMEN
          </span>
          <span class="font-mono tabular-nums text-[11px] text-(--color-income) leading-none">
            {{ store.cashflow()!.totalIncomeCents | klarMoney }}
          </span>
        </div>
        <div class="flex items-center h-[26px] px-4 gap-2">
          <span class="text-[13px] text-(--text) flex-1 leading-none">Fixe Einnahmen</span>
          <span class="font-mono tabular-nums text-[11px] text-(--color-income) leading-none">
            {{ store.cashflow()!.recurringIncomeCents | klarMoney }}
          </span>
        </div>
        <div class="flex items-center h-[26px] px-4 gap-2">
          <span class="text-[13px] text-(--text) flex-1 leading-none">Buchungen</span>
          <span class="font-mono tabular-nums text-[11px] text-(--color-income) leading-none">
            {{ store.cashflow()!.transactionIncomeCents | klarMoney }}
          </span>
        </div>
      </div>

      <div class="flex flex-col border-t border-(--border)">
        <div class="flex items-center h-[26px] px-4 gap-2 border-b border-(--border)">
          <span class="text-[9px] uppercase tracking-[0.1em] text-(--text-muted) font-medium flex-1 leading-none">
            AUSGABEN
          </span>
          <span class="font-mono tabular-nums text-[11px] text-(--color-expense) leading-none">
            {{ store.cashflow()!.totalExpensesCents | klarMoney }}
          </span>
        </div>
        <div class="flex items-center h-[26px] px-4 gap-2">
          <span class="text-[13px] text-(--text) flex-1 leading-none">Fixkosten</span>
          <span class="font-mono tabular-nums text-[11px] text-(--color-expense) leading-none">
            {{ store.cashflow()!.recurringExpensesCents | klarMoney }}
          </span>
        </div>
        <div class="flex items-center h-[26px] px-4 gap-2">
          <span class="text-[13px] text-(--text) flex-1 leading-none">Buchungen</span>
          <span class="font-mono tabular-nums text-[11px] text-(--color-expense) leading-none">
            {{ store.cashflow()!.transactionExpensesCents | klarMoney }}
          </span>
        </div>
      </div>

    </div>

  }

</div>

<!-- ── Mobile Day Detail Sheet ─────────────────────── -->
@if (sheetDay(); as sd) {
  <div class="fixed inset-0 bg-black/60 z-200 md:hidden"
       (click)="sheetDay.set(null)"></div>

  <div class="fixed bottom-0 left-0 right-0 z-201 md:hidden
              flex flex-col rounded-t-2xl border-t border-(--border)
              bg-(--surface) pb-[calc(env(safe-area-inset-bottom)+1rem)]">

    <div class="flex justify-center pt-3 pb-2 shrink-0">
      <div class="w-10 h-1 rounded-full bg-(--border)"></div>
    </div>

    <div class="px-5 py-2.5 border-b border-(--border) shrink-0">
      <p class="text-[11px] font-semibold uppercase tracking-widest text-(--text-muted)">
        {{ sheetDayLabel() }}
      </p>
    </div>

    @if (sd.events.length === 0) {
      <div class="px-5 py-10 text-center text-[13px] text-(--text-muted)">
        Keine Einträge für diesen Tag
      </div>
    } @else {
      <div class="flex flex-col gap-2 px-4 py-3 overflow-y-auto max-h-[55dvh]">
        @for (ev of sd.events; track $index) {
          <div class="flex items-center gap-3 rounded-[5px] px-3 py-2.5 border-l-2"
               [style.background]="ev.color + '18'"
               [style.borderLeftColor]="ev.color">
            <span class="flex-1 min-w-0 text-[13px] font-medium text-(--text) truncate">
              {{ ev.name }}
            </span>
            <span class="font-mono tabular-nums text-[13px] shrink-0"
                  [ngClass]="ev.amountCents | klarMoneyClass">
              {{ ev.amountCents | klarMoney }}
            </span>
          </div>
        }
        @if (sd.events.length > 1) {
          @let total = sd.events.reduce(sumAmounts, 0);
          <div class="flex items-center justify-between px-3 py-2.5
                      border-t border-(--border) mt-1">
            <span class="text-[10px] font-semibold uppercase tracking-widest text-(--text-muted)">
              GESAMT
            </span>
            <span class="font-mono tabular-nums text-[13px] font-semibold"
                  [ngClass]="total | klarMoneyClass">
              {{ total | klarMoney }}
            </span>
          </div>
        }
      </div>
    }
  </div>
}
```

- [ ] **Step 3.3: Update `monat.component.css` — keep only mobile-hero styles, remove stat-grid**

Read the current `apps/web/src/app/pages/monat/monat.component.css` to see which rules are needed. Remove any `.stat-grid`, `.stat-card`, `.page`, `.breakdown` CSS. Keep `.mobile-hero` and `.hero-*` rules unchanged (they are referenced in the template). Keep `.cal-nav-block` if it's defined there.

The key: if `.mobile-hero` and `.hero-*` rules exist in the CSS file, keep those verbatim. Everything else (`.page`, `.stat-grid`, `.breakdown`, `.bk-*`, `.status-bar`) — delete.

If the CSS file defines `.cal-nav-block`, keep it. Otherwise remove unused rules.

- [ ] **Step 3.4: TypeScript compile check**

```bash
pnpm --filter web exec tsc --noEmit
```
Expected: No errors.

- [ ] **Step 3.5: Commit**

```bash
git add apps/web/src/app/pages/monat/
git commit -m "feat(monat): remove stat cards, add 4-col inline stat row, 26px breakdown rows"
```

---

## Task 4: Buchungen — Remove stat strip, 26px tx rows, compact month nav

**Files:**
- Modify: `apps/web/src/app/pages/buchungen/buchungen.component.ts`
- Modify: `apps/web/src/app/pages/buchungen/buchungen.component.html`
- Modify: `apps/web/src/app/pages/buchungen/buchungen.component.css`

- [ ] **Step 4.1: Update `buchungen.component.ts` — remove BrandIconComponent, add pageHeader field and reactive stats effect**

Replace the entire content of `apps/web/src/app/pages/buchungen/buchungen.component.ts`:

```ts
import { Component, effect, inject } from '@angular/core';
import { NgClass } from '@angular/common';
import { KlarDialogService } from '../../shared/ui/klar-dialog.service';
import { TransactionsStore, Transaction } from '../../core/transactions/transactions.store';
import { PageHeaderService } from '../../core/page-header/page-header.service';
import { TransactionDialogComponent } from './transaction-dialog.component';
import { KlarMoneyPipe } from '../../shared/pipes/klar-money.pipe';
import { KlarMoneyClassPipe } from '../../shared/pipes/klar-money-class.pipe';
import { KlarErrorBarComponent } from '../../shared/ui/klar-error-bar.component';
import { KlarEmptyStateComponent } from '../../shared/ui/klar-empty-state.component';
import { KlarMonthPickerComponent } from '../../shared/ui/klar-month-picker.component';
import { KlarSkeletonRowsComponent } from '../../shared/ui/klar-skeleton-rows.component';

@Component({
  selector: 'app-buchungen',
  standalone: true,
  host: { class: 'flex flex-col flex-1 min-h-0 overflow-hidden' },
  imports: [NgClass, KlarMoneyPipe, KlarMoneyClassPipe, KlarErrorBarComponent, KlarEmptyStateComponent, KlarMonthPickerComponent, KlarSkeletonRowsComponent],
  templateUrl: './buchungen.component.html',
  styleUrl: './buchungen.component.css',
})
export class BuchungenPageComponent {
  protected store       = inject(TransactionsStore);
  private pageHeader    = inject(PageHeaderService);
  private dialogService = inject(KlarDialogService);

  constructor() {
    this.pageHeader.set({
      title:   'Buchungen',
      showAdd: true,
      addLabel: 'Buchung',
      onAdd:   () => this.openCreate(),
    });

    effect(() => {
      const income  = this.store.totalIncomeCents();
      const expense = this.store.totalExpenseCents();
      const netto   = this.store.nettoCents();
      this.pageHeader.stats.set([
        { label: 'Einnahmen', valueCents: income,  tone: 'income' },
        { label: 'Ausgaben',  valueCents: expense, tone: 'expense' },
        { label: 'Netto',     valueCents: netto,   tone: netto >= 0 ? 'surplus' : 'expense' },
      ]);
    });
  }

  openCreate(): void {
    this.dialogService.open({
      title:     'Buchung anlegen',
      component: TransactionDialogComponent,
      inputs:    { tx: null },
      width:     'sm',
    });
  }

  openEdit(tx: Transaction, event: Event): void {
    event.stopPropagation();
    this.dialogService.open({
      title:     'Buchung bearbeiten',
      component: TransactionDialogComponent,
      inputs:    { tx },
      width:     'sm',
    });
  }

  formatDate(dateStr: string): string {
    const parts = dateStr.split('-');
    if (parts.length < 3) return dateStr;
    return `${parts[2]}.${parts[1]}.`;
  }
}
```

- [ ] **Step 4.2: Rewrite `buchungen.component.html` — remove stat strip, 26px tx rows, compact month nav subheader**

Replace the entire content of `apps/web/src/app/pages/buchungen/buchungen.component.html`:

```html
<!-- Compact month nav — sticky subheader below topbar -->
<div class="flex items-center h-10 px-4 border-b border-(--border) bg-(--surface) shrink-0 sticky top-0 z-10">
  <klar-month-picker
    [month]="store.currentMonth()"
    (monthChange)="store.setMonth($event)" />
</div>

<!-- Loading -->
@if (store.loading()) {
  <klar-skeleton-rows [count]="8" class="flex-1 overflow-y-auto" />
}

<!-- Error -->
@else if (store.error()) {
  <klar-error-bar message="Fehler beim Laden der Buchungen." (retry)="store.reload()" />
}

<!-- Empty -->
@else if (store.isEmpty()) {
  <klar-empty-state message="Noch keine Buchungen für diesen Monat" />
}

<!-- Transaction list -->
@else {
  <div class="flex flex-col overflow-y-auto flex-1">
    @for (tx of store.sortedItems(); track tx.id) {
      <div class="flex items-center h-[26px] px-4 gap-2 cursor-pointer
                  hover:bg-(--surface-2) transition-colors duration-100"
           (click)="openEdit(tx, $event)">
        <span class="text-[9px] font-mono text-(--text-muted) w-[28px] shrink-0 tabular-nums leading-none">
          {{ formatDate(tx.date) }}
        </span>
        <span class="flex-1 text-[13px] text-(--text) truncate leading-none min-w-0">
          {{ tx.description }}
        </span>
        @if (tx.visibility === 'PRIVATE') {
          <span class="text-[8px] uppercase tracking-[0.08em] px-1.5 py-px rounded-sm
                       border border-(--border) text-(--text-muted) shrink-0 leading-none">
            PRIVAT
          </span>
        }
        <span class="font-mono tabular-nums text-[11px] w-[68px] text-right shrink-0 leading-none"
              [ngClass]="tx.amountCents | klarMoneyClass">
          {{ tx.amountCents | klarMoney }}
        </span>
      </div>
    }
  </div>
}
```

- [ ] **Step 4.3: Empty `buchungen.component.css` — remove all stat-strip and page rules**

Replace the entire content of `apps/web/src/app/pages/buchungen/buchungen.component.css` with empty content.

- [ ] **Step 4.4: TypeScript compile check**

```bash
pnpm --filter web exec tsc --noEmit
```
Expected: No errors.

- [ ] **Step 4.5: Commit**

```bash
git add apps/web/src/app/pages/buchungen/
git commit -m "feat(buchungen): remove stat strip, 26px tx rows, compact month nav subheader"
```

---

## Task 5: Projekte — Chip label, tighter cards, dot status badge

**Files:**
- Modify: `apps/web/src/app/pages/projekte/projekte.component.ts`
- Modify: `apps/web/src/app/pages/projekte/projekte.component.html`
- Modify: `apps/web/src/app/pages/projekte/projekte.component.css`

- [ ] **Step 5.1: Update `projekte.component.ts` — add pageHeader field, reactive chipLabel effect, statusDot() helper**

Replace the entire content of `apps/web/src/app/pages/projekte/projekte.component.ts`:

```ts
import { Component, effect, inject } from '@angular/core';
import { NgClass } from '@angular/common';
import { KlarSkeletonComponent } from '../../shared/ui/klar-skeleton.component';
import { ProjekteStore } from '../../core/overview/projekte.store';
import { PageHeaderService } from '../../core/page-header/page-header.service';
import { KlarMoneyPipe } from '../../shared/pipes/klar-money.pipe';
import { KlarMoneyClassPipe } from '../../shared/pipes/klar-money-class.pipe';
import { KlarErrorBarComponent } from '../../shared/ui/klar-error-bar.component';
import { KlarEmptyStateComponent } from '../../shared/ui/klar-empty-state.component';
import type { ProjectOverviewItem } from '../../core/overview/overview.service';

@Component({
  selector: 'app-projekte',
  standalone: true,
  host: { class: 'flex flex-col flex-1 min-h-0 overflow-hidden' },
  imports: [NgClass, KlarSkeletonComponent, KlarMoneyPipe, KlarMoneyClassPipe, KlarErrorBarComponent, KlarEmptyStateComponent],
  templateUrl: './projekte.component.html',
  styleUrl: './projekte.component.css',
})
export class ProjektePageComponent {
  protected store     = inject(ProjekteStore);
  private pageHeader  = inject(PageHeaderService);

  constructor() {
    this.pageHeader.set({
      title:   'Projekte',
      showAdd: true,
      addLabel: 'Projekt',
    });

    effect(() => {
      const count  = this.store.projects()?.projects.length ?? 0;
      const filter = this.store.statusFilter();
      const label  = filter === 'ACTIVE'    ? `${count} aktiv`
                   : filter === 'COMPLETED' ? `${count} abgeschl.`
                   : `${count} gesamt`;
      this.pageHeader.chipLabel.set(label);
    });
  }

  progressPercent(item: ProjectOverviewItem): number {
    if (!item.totalBudgetCents || item.totalBudgetCents === 0) return 0;
    const pct = (Math.abs(item.spentCents) / Math.abs(item.totalBudgetCents)) * 100;
    return Math.min(100, Math.max(0, Math.round(pct)));
  }

  statusLabel(status: string): string {
    switch (status) {
      case 'ACTIVE':    return 'AKTIV';
      case 'COMPLETED': return 'ABGESCHLOSSEN';
      case 'ARCHIVED':  return 'ARCHIVIERT';
      default:          return status;
    }
  }

  statusColor(status: string): string {
    switch (status) {
      case 'ACTIVE':    return 'text-(--color-income)';
      case 'COMPLETED': return 'text-(--text-muted)';
      case 'ARCHIVED':  return 'text-(--text-muted)';
      default:          return 'text-(--text-muted)';
    }
  }

  dotColor(status: string): string {
    switch (status) {
      case 'ACTIVE': return 'var(--color-income)';
      default:       return 'var(--text-muted)';
    }
  }

  readonly filters: { value: string; label: string }[] = [
    { value: 'ACTIVE',    label: 'Aktiv' },
    { value: 'COMPLETED', label: 'Abgeschlossen' },
    { value: 'ALL',       label: 'Alle' },
  ];

  setFilter(value: string): void {
    this.store.setStatusFilter(value);
  }
}
```

- [ ] **Step 5.2: Update `projekte.component.html` — tighter cards, dot status, compact stat row**

Read the current `apps/web/src/app/pages/projekte/projekte.component.html` to understand the existing project card structure. Then replace so that:
- Project card: `py-3 px-4` padding
- Status badge → `<span class="w-[5px] h-[5px] rounded-full shrink-0" [style.background]="dotColor(item.status)"></span>` + label text in `text-[8px] uppercase`
- Progress label: `X € Budget · Y %` on one line, 8px muted monospace
- Stat row: height 24px, labels 7px, values 10px mono, spacing only (no dividers)
- Transaction count: 8px muted, right-aligned, monospace

Read current file first, then rewrite. The key replacement for the status badge section (inside a project card):

Old pattern (badge):
```html
<span hlmBadge ...>{{ statusLabel(item.status) }}</span>
```

New pattern (dot + text):
```html
<span class="w-[5px] h-[5px] rounded-full shrink-0 inline-block"
      [style.background]="dotColor(item.status)"></span>
<span class="text-[8px] uppercase tracking-[0.08em] font-medium"
      [ngClass]="statusColor(item.status)">
  {{ statusLabel(item.status) }}
</span>
```

The progress bar label replaces whatever sub-label exists:
```html
<span class="text-[8px] font-mono text-(--text-muted) tabular-nums">
  {{ item.totalBudgetCents | klarMoney }} Budget · {{ progressPercent(item) }}&nbsp;%
</span>
```

- [ ] **Step 5.3: Update `projekte.component.css` — keep only project-card structural rules not expressible in Tailwind**

Remove any `.badge`, `.status-badge`, or old `.stat-strip` rules. Keep rules for the progress bar track if they use custom properties.

- [ ] **Step 5.4: TypeScript compile check**

```bash
pnpm --filter web exec tsc --noEmit
```
Expected: No errors.

- [ ] **Step 5.5: Commit**

```bash
git add apps/web/src/app/pages/projekte/
git commit -m "feat(projekte): project count chip, dot status, tighter cards"
```

---

## Task 6: Planspiel — Add host class, remove badge, add result stat, restyle form

**Files:**
- Modify: `apps/web/src/app/pages/planspiel/planspiel.component.ts`
- Modify: `apps/web/src/app/pages/planspiel/planspiel.component.html`
- Modify: `apps/web/src/app/pages/planspiel/planspiel.component.css`

- [ ] **Step 6.1: Update `planspiel.component.ts` — add host class, remove KlarBadgeComponent, add pageHeader field and reactive result stat**

Replace the entire content of `apps/web/src/app/pages/planspiel/planspiel.component.ts`:

```ts
import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { PlanspielStore } from '../../core/planspiel/planspiel.store';
import { KlarIconComponent } from '../../shared/icons/klar-icon.component';
import { PageHeaderService } from '../../core/page-header/page-header.service';
import { HlmButtonDirective } from '../../shared/ui/hlm/hlm-button.directive';
import { HlmInputDirective } from '../../shared/ui/hlm/hlm-input.directive';
import { HlmLabelDirective } from '../../shared/ui/hlm/hlm-label.directive';
import { HlmSelectNativeDirective } from '../../shared/ui/hlm/hlm-select/hlm-select-native.directive';
import type { RecurringFrequency } from '@klar/shared';
import { toMonthlyEquivalent } from '@klar/shared';

interface AddForm {
  label:      string;
  amountEuro: string;
  type:       'income' | 'expense';
  frequency:  RecurringFrequency;
  color:      string;
}

const PRESET_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#64748b',
];

@Component({
  selector: 'app-planspiel',
  standalone: true,
  host: { class: 'flex flex-col flex-1 min-h-0 overflow-hidden' },
  imports: [FormsModule, KlarIconComponent, HlmButtonDirective, HlmInputDirective, HlmLabelDirective, HlmSelectNativeDirective],
  templateUrl: './planspiel.component.html',
  styleUrl: './planspiel.component.css',
})
export class PlanspielPageComponent {
  protected store    = inject(PlanspielStore);
  private pageHeader = inject(PageHeaderService);

  protected readonly presetColors = PRESET_COLORS;

  protected showForm = signal(false);

  constructor() {
    const router = inject(Router);
    this.pageHeader.set({
      title:       'Planspiel',
      subtitle:    'SIMULATION — REIN LOKAL',
      showAdd:     true,
      addLabel:    'Eintrag',
      onAdd:       () => this.showForm.set(true),
      onPlanspiel: () => router.navigate(['/app/fixkosten']),
    });

    effect(() => {
      if (this.store.isEmpty()) {
        this.showForm.set(false);
      }
    });

    effect(() => {
      const surplus = this.store.result().surplusCents;
      this.pageHeader.stats.set([{
        label:      'Ergebnis',
        valueCents: surplus,
        tone:       surplus >= 0 ? 'surplus' : 'expense',
      }]);
    });
  }

  protected form = signal<AddForm>({
    label:      '',
    amountEuro: '',
    type:       'expense',
    frequency:  'MONTHLY',
    color:      PRESET_COLORS[0],
  });

  protected readonly formValid = computed(() => {
    const f = this.form();
    const amount = parseFloat(String(f.amountEuro ?? '').replace(',', '.'));
    return f.label.trim().length > 0 && !isNaN(amount) && amount > 0;
  });

  frequencyLabel(freq: RecurringFrequency): string {
    switch (freq) {
      case 'MONTHLY':     return 'Monatlich';
      case 'QUARTERLY':   return 'Quartalsweise';
      case 'YEARLY':      return 'Jährlich';
      case 'CUSTOM_DAYS': return 'Individuell';
    }
  }

  shortFreq(freq: RecurringFrequency): string {
    switch (freq) {
      case 'QUARTERLY':   return '/ Quartal';
      case 'YEARLY':      return '/ Jahr';
      case 'CUSTOM_DAYS': return '/ individuell';
      default:            return '/ Monat';
    }
  }

  monthlyEquiv(amountCents: number, freq: RecurringFrequency): number {
    return toMonthlyEquivalent(amountCents, freq);
  }

  formatCents(cents: number): string {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(cents / 100);
  }

  updateForm(patch: Partial<AddForm>): void {
    this.form.update(f => ({ ...f, ...patch }));
  }

  submitEntry(): void {
    if (!this.formValid()) return;
    const f = this.form();
    const absAmount = Math.round(parseFloat(String(f.amountEuro ?? '').replace(',', '.')) * 100);
    const amountCents = f.type === 'income' ? absAmount : -absAmount;

    this.store.addEntry({
      label: f.label.trim(),
      amountCents,
      frequency: f.frequency,
      color:     f.color,
    });

    this.form.update(current => ({ ...current, label: '', amountEuro: '' }));
  }

  openForm(): void {
    this.showForm.set(true);
  }

  closeForm(): void {
    this.showForm.set(false);
    this.form.set({ label: '', amountEuro: '', type: 'expense', frequency: 'MONTHLY', color: PRESET_COLORS[0] });
  }

  confirmReset(): void {
    if (this.store.entries().length === 0) return;
    this.store.reset();
  }
}
```

- [ ] **Step 6.2: Update `planspiel.component.html` — dot instead of badge, reskinned form, system tokens**

Read the current `apps/web/src/app/pages/planspiel/planspiel.component.html` to understand the existing structure.

Key changes to apply:
1. Replace any `<klar-badge>` elements with colored dot + text
2. Replace form background from ad-hoc Tailwind to `bg-(--surface-2) border border-(--border)`
3. Income/expense toggle: two `hlmBtn variant="ghost"` buttons with active state (emerald tint for income, rose tint for expense)
4. Entry list rows: 26px height, `border-l-2` in entry color, 5px dot + name + shortFreq suffix + monthly equivalent amount
5. Remove result summary card if present (result now lives in topbar via pageHeader.stats)
6. Replace `bg-card`, `border-border`, `text-muted-foreground`, `dark:text-white` with `bg-(--surface-2)`, `border-(--border)`, `text-(--text-muted)`, `text-(--text)`

Entry row pattern:
```html
<div class="flex items-center h-[26px] px-4 gap-2 border-l-2"
     [style.border-left-color]="entry.color">
  <span class="w-[5px] h-[5px] rounded-full shrink-0" [style.background]="entry.color"></span>
  <span class="flex-1 text-[13px] text-(--text) truncate leading-none min-w-0">
    {{ entry.label }}
  </span>
  <span class="text-[9px] text-(--text-muted) shrink-0 leading-none">
    {{ shortFreq(entry.frequency) }}
  </span>
  <span class="font-mono tabular-nums text-[11px] w-[68px] text-right shrink-0 leading-none"
        [class.text-(--color-income)]="entry.amountCents > 0"
        [class.text-(--color-expense)]="entry.amountCents < 0">
    {{ formatCents(monthlyEquiv(entry.amountCents, entry.frequency)) }}
  </span>
</div>
```

Form income/expense toggle pattern:
```html
<div class="flex gap-1">
  <button hlmBtn variant="ghost" size="sm" type="button"
          [class.bg-(--color-income)/10]="form().type === 'income'"
          [class.text-(--color-income)]="form().type === 'income'"
          (click)="updateForm({ type: 'income' })">
    Einnahme
  </button>
  <button hlmBtn variant="ghost" size="sm" type="button"
          [class.bg-(--color-expense)/10]="form().type === 'expense'"
          [class.text-(--color-expense)]="form().type === 'expense'"
          (click)="updateForm({ type: 'expense' })">
    Ausgabe
  </button>
</div>
```

- [ ] **Step 6.3: Update `planspiel.component.css` — remove any generic Tailwind token overrides**

Read the current `apps/web/src/app/pages/planspiel/planspiel.component.css`. Remove any rules using `bg-card`, `border-border`, `text-muted-foreground`, or hardcoded hex colors. Replace with nothing (the template uses CSS variables directly). Keep only structural rules needed that can't be expressed in Tailwind.

- [ ] **Step 6.4: TypeScript compile check**

```bash
pnpm --filter web exec tsc --noEmit
```
Expected: No errors.

- [ ] **Step 6.5: Commit**

```bash
git add apps/web/src/app/pages/planspiel/
git commit -m "feat(planspiel): add host class, result topbar stat, dot entries, reskinned form"
```

---

## Task 7: Settings — Hairline sections, 26px field rows, compact profile block

**Files:**
- Modify: `apps/web/src/app/pages/settings/settings.component.html`
- Modify: `apps/web/src/app/pages/settings/settings.component.css`

- [ ] **Step 7.1: Read the full `settings.component.html`**

Read `apps/web/src/app/pages/settings/settings.component.html` (all lines) to understand existing structure before making changes.

- [ ] **Step 7.2: Update `settings.component.html` — remove section-body cards, hairline dividers, 26px field rows, compact profile block**

Key changes:
1. Remove `<div class="section-body">` wrappers — sections sit directly on page background
2. Add `border-t border-(--border)` between sections (first section needs no top border)
3. Field rows: change from multi-line to `flex items-center h-[26px] px-4 gap-2`
4. Field label: `text-[9px] uppercase tracking-[0.08em] text-(--text-muted) font-medium w-[90px] shrink-0`
5. Field value: `text-[13px] text-(--text) flex-1`
6. Profile block: Avatar 28px inline with name + email on same row (not stacked)
   ```html
   <div class="flex items-center h-[26px] px-4 gap-3">
     <div class="w-[28px] h-[28px] rounded-full bg-(--surface-2) border border-(--border)
                 flex items-center justify-center text-[11px] font-medium text-(--text-muted) shrink-0">
       {{ initials() }}
     </div>
     <span class="text-[12px] font-medium text-(--text)">{{ store.profile()?.displayName }}</span>
     <span class="text-[9px] text-(--text-muted)">{{ store.profile()?.email }}</span>
   </div>
   ```
7. Email verification: Replace badge with `<span class="w-[4px] h-[4px] rounded-full bg-(--color-income) shrink-0"></span>` + `Verifiziert` text

The section-header stays: `<div class="flex items-center h-[26px] px-4 gap-2">` with `<span class="text-[9px] uppercase tracking-[0.1em] text-(--text-muted) font-medium flex-1">` for the label and a ghost button slot on the right.

- [ ] **Step 7.3: Update `settings.component.css` — remove section-body, profile-row, field-row CSS rules**

Read the current CSS file. Remove `.section-body`, `.profile-row`, `.field-row`, `.field-label`, `.field-value`, `.avatar-lg`, `.badge-*` rules. Keep edit-form, field-group, and form-actions styles (these are for the inline edit form which stays structurally unchanged). Keep `.cancel-btn` style.

- [ ] **Step 7.4: TypeScript compile check**

```bash
pnpm --filter web exec tsc --noEmit
```
Expected: No errors.

- [ ] **Step 7.5: Commit**

```bash
git add apps/web/src/app/pages/settings/
git commit -m "feat(settings): hairline sections, 26px field rows, compact profile block"
```

---

## Task 8: Haushalt — Hairline sections, 26px member rows

**Files:**
- Modify: `apps/web/src/app/pages/haushalt/haushalt.component.html`
- Modify: `apps/web/src/app/pages/haushalt/haushalt.component.css`

- [ ] **Step 8.1: Read the full `haushalt.component.html`**

Read `apps/web/src/app/pages/haushalt/haushalt.component.html` (all lines) to understand existing structure.

- [ ] **Step 8.2: Update `haushalt.component.html` — remove page-header block, hairline sections, 26px member rows**

Key changes:
1. Remove `<div class="page-header">` block (page title/super label) — title is in the topbar now
2. Remove `<div class="page">` wrapper — host binding already sets flex layout
3. Section separators: `border-t border-(--border)` between sections
4. Section header: `flex items-center h-[26px] px-4 gap-2 border-b border-(--border)` with `text-[9px] uppercase` label
5. Member rows: 26px height. Avatar 20px (`w-[20px] h-[20px] rounded-full text-[9px]`). Name flex-1 at 13px. Role at 8px muted right-aligned.

Member row pattern:
```html
<div class="flex items-center h-[26px] px-4 gap-2">
  <div class="w-[20px] h-[20px] rounded-full border border-(--border)
              flex items-center justify-center text-[9px] font-medium text-(--text-muted) shrink-0">
    {{ member.displayName.slice(0, 2).toUpperCase() }}
  </div>
  <span class="flex-1 text-[13px] text-(--text) leading-none">{{ member.displayName }}</span>
  <span class="text-[8px] text-(--text-muted) font-medium uppercase tracking-[0.06em] leading-none">
    {{ member.role }}
  </span>
</div>
```

API keys rows follow the same Settings field row pattern (`h-[26px] px-4`).

- [ ] **Step 8.3: Update `haushalt.component.css` — remove page-header, member-row, section-body CSS rules**

Read the current CSS file. Remove `.page-header`, `.page-title`, `.page-super`, `.section-body`, `.member-row`, `.member-avatar`, `.member-info`, `.member-name`, `.member-email`, `.name-block`, `.name-value`, `.name-meta` rules. Keep `.edit-row`, `.cancel-btn`, and any inline-form structural rules.

- [ ] **Step 8.4: TypeScript compile check**

```bash
pnpm --filter web exec tsc --noEmit
```
Expected: No errors.

- [ ] **Step 8.5: Final full build verification**

```bash
pnpm --filter web build
```
Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 8.6: Commit**

```bash
git add apps/web/src/app/pages/haushalt/
git commit -m "feat(haushalt): hairline sections, 26px member rows, remove page-header block"
```

---

## Done

All 8 tasks complete. The app now implements the Zero Chrome overhaul:
- `--spacing-table-row` updated to 26px globally
- Topbar renders page-specific stats reactively via `pageHeader.stats`
- Projekte shows item count as chip via `pageHeader.chipLabel`
- Stat strips removed from Fixkosten, Buchungen
- 4 stat cards removed from Monat → replaced with 4-column inline stat row
- Individual rows are 26px across all pages; brand icons removed; freq hints inline
- Settings and Haushalt use hairline dividers instead of card wrappers
- Planspiel has host class, correct system tokens, reskinned form
- `klar-stat-card` and `klar-skeleton-cards` are unused (deprecated per spec; component files stay)
