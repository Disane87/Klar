# Brand Icons, Categories & Universal Dialogs — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add brand auto-icons (Iconify Simple Icons) to all list rows, make recurring-transaction edits fully-featured (category, frequency, day-of-month), and build a single reusable `TransactionDialogComponent` for create + edit on the Buchungen page.

**Architecture:** `CategoriesStore` is a shared singleton (`providedIn: 'root'`) that loads categories once and feeds both dialog types. `BrandIconComponent` maps keywords in entry names to Simple Icons slugs and renders via `@iconify/angular`; unknown brands fall back to a generic icon. `TransactionDialogComponent` receives `tx = input<Transaction | null>(null)` — null means create mode, a Transaction means edit mode — keeping a single implementation for both flows.

**Tech Stack:** Angular 21 Zoneless Signals, `@iconify/angular`, `@iconify-json/simple-icons`, existing `KlarDialogService` / `KlarDialogComponent`, `KlarButtonComponent`, NestJS/Prisma backend.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `apps/web/src/app/core/categories/categories.store.ts` | Singleton: loads `/categories`, exposes `all()` and `active()` signals |
| Modify | `apps/api/src/overview/overview.service.ts:141-152` | Add `categoryId` to `FixedCostsItemResponse` |
| Modify | `apps/web/src/app/core/overview/overview.service.ts` | Add `categoryId: string` to `FixedCostItem` |
| Modify | `apps/web/src/app/core/recurring-transactions/recurring-transactions.service.ts` | Expand `UpdateRecurringTransactionRequest` with `categoryId?`, `frequency?`, `dayOfMonth?` |
| Modify | `apps/web/src/app/pages/fixkosten/recurring-edit-dialog.component.ts` | Add category/frequency/dayOfMonth form state + save fields |
| Modify | `apps/web/src/app/pages/fixkosten/recurring-edit-dialog.component.html` | Add select fields + dayOfMonth input |
| Modify | `apps/web/src/app/pages/fixkosten/recurring-edit-dialog.component.css` | Add select styles |
| Modify | `apps/web/src/app/app.config.ts` | Register Iconify Simple Icons collection |
| Create | `apps/web/src/app/shared/ui/brand-icon.component.ts` | Keyword → Simple Icons slug map, renders iconify-icon or generic fallback |
| Create | `apps/web/src/app/shared/ui/brand-icon.component.css` | Icon sizing |
| Modify | `apps/web/src/app/pages/fixkosten/fixkosten.component.ts` | Import BrandIconComponent |
| Modify | `apps/web/src/app/pages/fixkosten/fixkosten.component.html` | Replace `row-arrow` span with `<app-brand-icon>` |
| Modify | `apps/web/src/app/pages/fixkosten/fixkosten.component.css` | Remove `.row-arrow` rule |
| Create | `apps/web/src/app/core/transactions/transactions.service.ts` | CRUD: `post()`, `patch()`, `delete()` for `/transactions` |
| Create | `apps/web/src/app/pages/buchungen/transaction-dialog.component.ts` | Combined create/edit dialog: `tx = input<Transaction \| null>(null)` |
| Create | `apps/web/src/app/pages/buchungen/transaction-dialog.component.html` | Form: description, amount, date, category, visibility |
| Create | `apps/web/src/app/pages/buchungen/transaction-dialog.component.css` | Form layout (mirrors recurring-edit-dialog.component.css) |
| Modify | `apps/web/src/app/pages/buchungen/buchungen.component.ts` | Wire openEdit / openCreate → dialogService.open() |
| Modify | `apps/web/src/app/pages/buchungen/buchungen.component.html` | Add BrandIconComponent, click handler on tx rows |

---

## Task 1 — `CategoriesStore` + add `categoryId` to `FixedCostItem`

**Files:**
- Create: `apps/web/src/app/core/categories/categories.store.ts`
- Modify: `apps/api/src/overview/overview.service.ts` (lines 141–152)
- Modify: `apps/web/src/app/core/overview/overview.service.ts`

- [ ] **Create CategoriesStore**

```ts
// apps/web/src/app/core/categories/categories.store.ts
import { Injectable, computed, inject, resource } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type { Category } from '@klar/shared';
import { HouseholdStore } from '../household/household.store';

@Injectable({ providedIn: 'root' })
export class CategoriesStore {
  private http           = inject(HttpClient);
  private householdStore = inject(HouseholdStore);

  private _resource = resource<Category[], { householdId: string | null }>({
    params: () => ({ householdId: this.householdStore.activeId() }),
    loader: ({ params }) => {
      if (!params.householdId) return Promise.resolve([]);
      return firstValueFrom(
        this.http.get<Category[]>(
          `/api/v1/households/${params.householdId}/categories`,
        ),
      );
    },
  });

  readonly all    = computed(() => this._resource.value() ?? []);
  readonly active = computed(() => this.all().filter(c => !c.isArchived));
  readonly loading = this._resource.isLoading;
}
```

- [ ] **Add `categoryId` to backend `FixedCostsItemResponse`**

In `apps/api/src/overview/overview.service.ts`, the `FixedCostsItemResponse` interface (lines 15–23) and item builder (lines 141–152):

```ts
// Interface — add one field:
export interface FixedCostsItemResponse {
  id: string;
  categoryId: string;          // ← ADD
  name: string;
  amountCents: number;
  monthlyEquivalentCents: number;
  frequency: string;
  isVariable: boolean;
  dayOfMonth: number | null;
}

// Item builder in getFixedCosts() — add categoryId:
const responseItems: FixedCostsItemResponse[] = items.map((rt) => ({
  id: rt.id,
  categoryId: rt.categoryId,   // ← ADD
  name: rt.name,
  amountCents: rt.amountCents,
  monthlyEquivalentCents: toMonthlyEquivalent(
    rt.amountCents,
    rt.frequency as RecurringFrequency,
  ),
  frequency: rt.frequency,
  isVariable: rt.isVariable,
  dayOfMonth: rt.dayOfMonth,
}));
```

- [ ] **Add `categoryId` to frontend `FixedCostItem`**

In `apps/web/src/app/core/overview/overview.service.ts`:

```ts
export interface FixedCostItem {
  id: string;
  categoryId: string;           // ← ADD
  name: string;
  amountCents: number;
  monthlyEquivalentCents: number;
  frequency: RecurringFrequency;
  isVariable: boolean;
  dayOfMonth: number | null;
}
```

- [ ] **Build to verify no TypeScript errors**

```bash
pnpm --filter @klar/web build --configuration=development 2>&1 | grep -E "error|complete"
pnpm --filter @klar/api build 2>&1 | grep -E "error|complete"
```

Expected: `Application bundle generation complete.` / `Compilation complete.` with no errors.

- [ ] **Commit**

```bash
git add apps/web/src/app/core/categories/categories.store.ts \
        apps/api/src/overview/overview.service.ts \
        apps/web/src/app/core/overview/overview.service.ts
git commit -m "feat: CategoriesStore + categoryId on FixedCostItem"
```

---

## Task 2 — Extend `RecurringTransactionsService` + `RecurringEditDialog`

**Files:**
- Modify: `apps/web/src/app/core/recurring-transactions/recurring-transactions.service.ts`
- Modify: `apps/web/src/app/pages/fixkosten/recurring-edit-dialog.component.ts`
- Modify: `apps/web/src/app/pages/fixkosten/recurring-edit-dialog.component.html`
- Modify: `apps/web/src/app/pages/fixkosten/recurring-edit-dialog.component.css`

- [ ] **Expand `UpdateRecurringTransactionRequest`**

Replace the entire file:

```ts
// apps/web/src/app/core/recurring-transactions/recurring-transactions.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type { RecurringFrequency } from '@klar/shared';

export interface UpdateRecurringTransactionRequest {
  name?:        string;
  amountCents?: number;
  categoryId?:  string;
  frequency?:   RecurringFrequency;
  dayOfMonth?:  number | null;
}

@Injectable({ providedIn: 'root' })
export class RecurringTransactionsService {
  private http = inject(HttpClient);

  patch(
    householdId: string,
    id: string,
    body: UpdateRecurringTransactionRequest,
  ): Promise<void> {
    return firstValueFrom(
      this.http.patch<void>(
        `/api/v1/households/${householdId}/recurring-transactions/${id}`,
        body,
      ),
    );
  }
}
```

- [ ] **Rewrite `recurring-edit-dialog.component.ts`**

```ts
// apps/web/src/app/pages/fixkosten/recurring-edit-dialog.component.ts
import { Component, effect, inject, input, signal, computed } from '@angular/core';
import { KlarDialogService } from '../../shared/ui/klar-dialog.service';
import { KlarButtonComponent } from '../../shared/ui/klar-button.component';
import { OverviewStore } from '../../core/overview/overview.store';
import { HouseholdStore } from '../../core/household/household.store';
import { CategoriesStore } from '../../core/categories/categories.store';
import { RecurringTransactionsService } from '../../core/recurring-transactions/recurring-transactions.service';
import { KlarToastService } from '../../shared/ui/klar-toast.service';
import type { FixedCostItem } from '../../core/overview/overview.service';
import type { RecurringFrequency } from '@klar/shared';
import { safeDayOfMonth } from '@klar/shared';

@Component({
  selector: 'app-recurring-edit-dialog',
  standalone: true,
  imports: [KlarButtonComponent],
  templateUrl: './recurring-edit-dialog.component.html',
  styleUrl: './recurring-edit-dialog.component.css',
})
export class RecurringEditDialogComponent {
  item = input.required<FixedCostItem>();

  private dialog     = inject(KlarDialogService);
  private store      = inject(OverviewStore);
  private household  = inject(HouseholdStore);
  private recurring  = inject(RecurringTransactionsService);
  private toast      = inject(KlarToastService);
  protected cats     = inject(CategoriesStore);

  readonly name       = signal('');
  readonly monthly    = signal('');
  readonly categoryId = signal('');
  readonly frequency  = signal<RecurringFrequency>('MONTHLY');
  readonly dayOfMonth = signal<string>('');  // string for input binding
  readonly saving     = signal(false);
  readonly err        = signal('');

  constructor() {
    effect(() => {
      const i = this.item();
      this.name.set(i.name);
      this.monthly.set(this.centsToDisplay(i.monthlyEquivalentCents));
      this.categoryId.set(i.categoryId);
      this.frequency.set(i.frequency);
      this.dayOfMonth.set(i.dayOfMonth != null ? String(i.dayOfMonth) : '');
    });
  }

  readonly isValid = computed(() => {
    const n = this.name().trim();
    const m = this.parseMonthly(this.monthly());
    const c = this.categoryId();
    return n.length > 0 && !isNaN(m) && c.length > 0;
  });

  readonly freqOptions: { value: RecurringFrequency; label: string }[] = [
    { value: 'MONTHLY',   label: 'Monatlich' },
    { value: 'QUARTERLY', label: 'Quartalsweise' },
    { value: 'YEARLY',    label: 'Jährlich' },
  ];

  readonly freqHint = computed(() => {
    const f = this.frequency();
    if (f === 'QUARTERLY') return '× 3 = Quartalsbetrag';
    if (f === 'YEARLY')    return '× 12 = Jahresbetrag';
    return '';
  });

  async save(): Promise<void> {
    if (!this.isValid() || this.saving()) return;
    const hid = this.household.activeId();
    if (!hid) return;

    const monthlyCents = this.parseMonthly(this.monthly());
    const freq         = this.frequency();
    const actualCents  = this.toActualCents(monthlyCents, freq);
    const dom          = parseInt(this.dayOfMonth(), 10);
    const clampedDay   = isNaN(dom) ? null
      : safeDayOfMonth(new Date().getFullYear(), new Date().getMonth() + 1, dom);

    this.saving.set(true);
    this.err.set('');
    try {
      await this.recurring.patch(hid, this.item().id, {
        name:        this.name().trim(),
        amountCents: actualCents,
        categoryId:  this.categoryId(),
        frequency:   freq,
        dayOfMonth:  clampedDay,
      });
      this.store.reload();
      this.dialog.close();
      this.toast.success('Gespeichert');
    } catch {
      this.err.set('Speichern fehlgeschlagen. Bitte erneut versuchen.');
    } finally {
      this.saving.set(false);
    }
  }

  cancel(): void { this.dialog.close(); }

  private centsToDisplay(cents: number): string {
    return (cents / 100).toFixed(2).replace('.', ',');
  }

  private parseMonthly(value: string): number {
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

- [ ] **Rewrite `recurring-edit-dialog.component.html`**

```html
<!-- apps/web/src/app/pages/fixkosten/recurring-edit-dialog.component.html -->
<div class="form">

  <div class="field">
    <label class="field-label" for="red-name">Name</label>
    <input id="red-name" class="field-input" type="text"
           [placeholder]="item().name"
           [value]="name()"
           (input)="name.set($any($event.target).value)" />
  </div>

  <div class="field">
    <label class="field-label" for="red-monthly">Betrag / Monat (€)</label>
    <input id="red-monthly" class="field-input field-input--mono" type="text"
           inputmode="decimal" placeholder="0,00"
           [value]="monthly()"
           (input)="monthly.set($any($event.target).value)" />
    @if (freqHint()) {
      <span class="field-hint">{{ freqHint() }}</span>
    }
  </div>

  <div class="field">
    <label class="field-label" for="red-category">Kategorie</label>
    <select id="red-category" class="field-select"
            [value]="categoryId()"
            (change)="categoryId.set($any($event.target).value)">
      <option value="" disabled>Kategorie wählen…</option>
      @for (cat of cats.active(); track cat.id) {
        <option [value]="cat.id">{{ cat.name }}</option>
      }
    </select>
  </div>

  <div class="field">
    <label class="field-label" for="red-freq">Frequenz</label>
    <select id="red-freq" class="field-select"
            [value]="frequency()"
            (change)="frequency.set($any($event.target).value)">
      @for (opt of freqOptions; track opt.value) {
        <option [value]="opt.value">{{ opt.label }}</option>
      }
    </select>
  </div>

  <div class="field">
    <label class="field-label" for="red-day">Buchungstag (1–31)</label>
    <input id="red-day" class="field-input field-input--mono" type="number"
           min="1" max="31" placeholder="–"
           [value]="dayOfMonth()"
           (input)="dayOfMonth.set($any($event.target).value)" />
  </div>

  @if (err()) {
    <p class="err-msg">{{ err() }}</p>
  }

  <div class="actions">
    <klar-button variant="ghost" label="Abbrechen" (clicked)="cancel()" />
    <klar-button variant="primary" label="Speichern"
                 [loading]="saving()" [disabled]="!isValid()"
                 (clicked)="save()" />
  </div>
</div>
```

- [ ] **Update `recurring-edit-dialog.component.css`** — add select styles after `.field-input--mono`:

```css
/* Add after existing .field-input--mono rule */
.field-select {
  font-size: 14px;
  font-family: var(--font-sans);
  color: var(--text);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm, 2px);
  padding: 8px 10px;
  outline: none;
  width: 100%;
  box-sizing: border-box;
  cursor: pointer;
  transition: border-color 100ms;
  -webkit-appearance: none;
  appearance: none;
}

.field-select:focus {
  border-color: var(--color-accent, #3b82f6);
}
```

- [ ] **Build to verify**

```bash
pnpm --filter @klar/web build --configuration=development 2>&1 | grep -E "error|complete"
```

- [ ] **Commit**

```bash
git add apps/web/src/app/core/recurring-transactions/recurring-transactions.service.ts \
        apps/web/src/app/pages/fixkosten/recurring-edit-dialog.component.ts \
        apps/web/src/app/pages/fixkosten/recurring-edit-dialog.component.html \
        apps/web/src/app/pages/fixkosten/recurring-edit-dialog.component.css
git commit -m "feat: recurring-edit dialog — category, frequency, day-of-month editable"
```

---

## Task 3 — Install Iconify + `BrandIconComponent`

**Files:**
- Modify: `apps/web/src/app/app.config.ts`
- Create: `apps/web/src/app/shared/ui/brand-icon.component.ts`
- Create: `apps/web/src/app/shared/ui/brand-icon.component.css`

- [ ] **Install packages**

```bash
pnpm --filter @klar/web add @iconify/angular @iconify-json/simple-icons
```

Expected output: packages added, no errors.

- [ ] **Register Simple Icons collection in `app.config.ts`**

Add at the top of `apps/web/src/app/app.config.ts`:

```ts
import { addCollection } from '@iconify/angular';
import SimpleIconsData from '@iconify-json/simple-icons/icons.json';
// Register all Simple Icons so BrandIconComponent can use them offline
addCollection(SimpleIconsData);
```

The `import … from '…/icons.json'` requires `resolveJsonModule: true` in tsconfig — Angular CLI sets this by default. If the TypeScript compiler complains add `"resolveJsonModule": true` to `apps/web/tsconfig.json` under `compilerOptions`.

- [ ] **Create `BrandIconComponent`**

```ts
// apps/web/src/app/shared/ui/brand-icon.component.ts
import { Component, input, computed } from '@angular/core';
import { IconComponent } from '@iconify/angular';
import { KlarIconComponent } from '../icons/klar-icon.component';

// Map: substring of entry name (lowercase) → Simple Icons slug
const BRAND_MAP: [string, string][] = [
  ['spotify',    'spotify'],
  ['netflix',    'netflix'],
  ['github',     'github'],
  ['claude',     'anthropic'],
  ['anthropic',  'anthropic'],
  ['chatgpt',    'openai'],
  ['openai',     'openai'],
  ['vodafone',   'vodafone'],
  ['icloud',     'apple'],
  ['apple',      'apple'],
  ['hetzner',    'hetzner'],
  ['hp ',        'hp'],            // trailing space avoids matching "php"
  ['all-inkl',   'all-inkl'],
  ['splice',     'splice'],
  ['lbs',        'lbs'],
  ['adac',       'adac'],
  ['sparkasse',  'sparkasse'],
  ['ergo',       'ergo'],
  ['linkedin',   'linkedin'],
  ['microsoft',  'microsoft'],
  ['google',     'google'],
  ['amazon',     'amazon'],
  ['discord',    'discord'],
  ['slack',      'slack'],
  ['notion',     'notion'],
  ['figma',      'figma'],
];

@Component({
  selector: 'app-brand-icon',
  standalone: true,
  imports: [IconComponent, KlarIconComponent],
  templateUrl: './brand-icon.component.html',
  styleUrl: './brand-icon.component.css',
})
export class BrandIconComponent {
  name = input.required<string>();
  size = input(14);

  readonly slug = computed(() => {
    const lower = this.name().toLowerCase();
    for (const [keyword, slug] of BRAND_MAP) {
      if (lower.includes(keyword)) return slug;
    }
    return null;
  });
}
```

- [ ] **Create `brand-icon.component.html`**

```html
<!-- apps/web/src/app/shared/ui/brand-icon.component.html -->
@if (slug(); as s) {
  <iconify-icon
    [icon]="'simple-icons:' + s"
    [width]="size()"
    [height]="size()"
    class="brand-icon" />
} @else {
  <klar-icon name="tag" [size]="size()" class="brand-icon" />
}
```

Note: `@iconify/angular` renders `<iconify-icon>` as an Angular component (not a web component). It needs to be inside `imports: [IconComponent]` in the parent.

- [ ] **Create `brand-icon.component.css`**

```css
/* apps/web/src/app/shared/ui/brand-icon.component.css */
:host {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: var(--text-muted);
}

.brand-icon {
  display: block;
}
```

- [ ] **Verify Iconify renders correctly**

```bash
pnpm --filter @klar/web build --configuration=development 2>&1 | grep -E "error|complete"
```

If `IconComponent` selector is not `iconify-icon`, check after running: `cat node_modules/@iconify/angular/lib/*.d.ts | grep selector` — if it's different, update the template accordingly.

- [ ] **Commit**

```bash
git add apps/web/src/app/app.config.ts \
        apps/web/src/app/shared/ui/brand-icon.component.ts \
        apps/web/src/app/shared/ui/brand-icon.component.html \
        apps/web/src/app/shared/ui/brand-icon.component.css
git commit -m "feat: BrandIconComponent with Iconify Simple Icons"
```

---

## Task 4 — Wire brand icons into Fixkosten rows

**Files:**
- Modify: `apps/web/src/app/pages/fixkosten/fixkosten.component.ts`
- Modify: `apps/web/src/app/pages/fixkosten/fixkosten.component.html`
- Modify: `apps/web/src/app/pages/fixkosten/fixkosten.component.css`

- [ ] **Add `BrandIconComponent` to `fixkosten.component.ts` imports**

In `apps/web/src/app/pages/fixkosten/fixkosten.component.ts`, add to the `imports` array:

```ts
import { BrandIconComponent } from '../../shared/ui/brand-icon.component';

// in @Component decorator:
imports: [LowerCasePipe, KlarSkeletonComponent, KlarIconComponent, BrandIconComponent],
```

- [ ] **Replace `row-arrow` with brand icon in template**

In `apps/web/src/app/pages/fixkosten/fixkosten.component.html`, replace:

```html
<span class="row-arrow">↳</span>
```

with:

```html
<app-brand-icon [name]="item.name" [size]="12" />
```

- [ ] **Remove `.row-arrow` CSS rule from `fixkosten.component.css`**

Delete the following block:

```css
.row-arrow {
  font-size: 11px;
  color: var(--text-muted);
  font-family: var(--font-mono);
}
```

- [ ] **Build + verify**

```bash
pnpm --filter @klar/web build --configuration=development 2>&1 | grep -E "error|complete"
```

- [ ] **Commit**

```bash
git add apps/web/src/app/pages/fixkosten/fixkosten.component.ts \
        apps/web/src/app/pages/fixkosten/fixkosten.component.html \
        apps/web/src/app/pages/fixkosten/fixkosten.component.css
git commit -m "feat: brand icons in fixkosten ledger rows"
```

---

## Task 5 — `TransactionsService` (CRUD)

**Files:**
- Create: `apps/web/src/app/core/transactions/transactions.service.ts`

- [ ] **Create `TransactionsService`**

```ts
// apps/web/src/app/core/transactions/transactions.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type { Transaction, CreateTransactionRequest, UpdateTransactionRequest } from '@klar/shared';

@Injectable({ providedIn: 'root' })
export class TransactionsService {
  private http = inject(HttpClient);

  private base(householdId: string): string {
    return `/api/v1/households/${householdId}/transactions`;
  }

  create(householdId: string, body: CreateTransactionRequest): Promise<Transaction> {
    return firstValueFrom(
      this.http.post<Transaction>(this.base(householdId), body),
    );
  }

  patch(householdId: string, id: string, body: UpdateTransactionRequest): Promise<Transaction> {
    return firstValueFrom(
      this.http.patch<Transaction>(`${this.base(householdId)}/${id}`, body),
    );
  }

  delete(householdId: string, id: string): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(`${this.base(householdId)}/${id}`),
    );
  }
}
```

Note: `Transaction`, `CreateTransactionRequest`, `UpdateTransactionRequest` are all exported from `@klar/shared`. The `Transaction` type from the store (`transactions.store.ts`) has a slightly different shape — prefer the shared type going forward.

- [ ] **Build to verify**

```bash
pnpm --filter @klar/web build --configuration=development 2>&1 | grep -E "error|complete"
```

- [ ] **Commit**

```bash
git add apps/web/src/app/core/transactions/transactions.service.ts
git commit -m "feat: TransactionsService — create, patch, delete"
```

---

## Task 6 — `TransactionDialogComponent` (combined create + edit)

**Files:**
- Create: `apps/web/src/app/pages/buchungen/transaction-dialog.component.ts`
- Create: `apps/web/src/app/pages/buchungen/transaction-dialog.component.html`
- Create: `apps/web/src/app/pages/buchungen/transaction-dialog.component.css`

The `Transaction` type used here is the one from `apps/web/src/app/core/transactions/transactions.store.ts` (local interface), which is what `TransactionsStore.sortedItems()` returns.

- [ ] **Create `transaction-dialog.component.ts`**

```ts
// apps/web/src/app/pages/buchungen/transaction-dialog.component.ts
import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { KlarDialogService } from '../../shared/ui/klar-dialog.service';
import { KlarButtonComponent } from '../../shared/ui/klar-button.component';
import { CategoriesStore } from '../../core/categories/categories.store';
import { HouseholdStore } from '../../core/household/household.store';
import { TransactionsService } from '../../core/transactions/transactions.service';
import { TransactionsStore } from '../../core/transactions/transactions.store';
import { KlarToastService } from '../../shared/ui/klar-toast.service';
import type { Transaction } from '../../core/transactions/transactions.store';

@Component({
  selector: 'app-transaction-dialog',
  standalone: true,
  imports: [KlarButtonComponent],
  templateUrl: './transaction-dialog.component.html',
  styleUrl: './transaction-dialog.component.css',
})
export class TransactionDialogComponent {
  // null → create mode; Transaction → edit mode
  tx = input<Transaction | null>(null);

  private dialog    = inject(KlarDialogService);
  private household = inject(HouseholdStore);
  private service   = inject(TransactionsService);
  private store     = inject(TransactionsStore);
  private toast     = inject(KlarToastService);
  protected cats    = inject(CategoriesStore);

  readonly description = signal('');
  readonly amount      = signal('');   // display string, e.g. "-50,00"
  readonly date        = signal('');   // YYYY-MM-DD
  readonly categoryId  = signal('');
  readonly visibility  = signal<'SHARED' | 'PRIVATE'>('SHARED');
  readonly saving      = signal(false);
  readonly err         = signal('');

  readonly isEditMode = computed(() => this.tx() !== null);

  constructor() {
    effect(() => {
      const t = this.tx();
      if (t) {
        this.description.set(t.description ?? '');
        this.amount.set(this.centsToDisplay(t.amountCents));
        this.date.set(t.date);
        this.categoryId.set(t.categoryId ?? '');
        this.visibility.set(t.visibility);
      } else {
        // Create defaults
        this.description.set('');
        this.amount.set('');
        this.date.set(new Date().toISOString().slice(0, 10)); // YYYY-MM-DD
        this.categoryId.set('');
        this.visibility.set('SHARED');
      }
    });
  }

  readonly isValid = computed(() => {
    const d = this.description().trim();
    const a = this.parseCents(this.amount());
    const dt = this.date();
    const c = this.categoryId();
    return d.length > 0 && !isNaN(a) && a !== 0 && dt.length === 10 && c.length > 0;
  });

  async save(): Promise<void> {
    if (!this.isValid() || this.saving()) return;
    const hid = this.household.activeId();
    if (!hid) return;

    const body = {
      description: this.description().trim(),
      amountCents: this.parseCents(this.amount()),
      date:        this.date(),
      categoryId:  this.categoryId(),
      visibility:  this.visibility(),
    };

    this.saving.set(true);
    this.err.set('');
    try {
      const t = this.tx();
      if (t) {
        await this.service.patch(hid, t.id, body);
        this.toast.success('Gespeichert');
      } else {
        await this.service.create(hid, body);
        this.toast.success('Buchung angelegt');
      }
      this.store.reload();
      this.dialog.close();
    } catch {
      this.err.set('Speichern fehlgeschlagen. Bitte erneut versuchen.');
    } finally {
      this.saving.set(false);
    }
  }

  async remove(): Promise<void> {
    const t = this.tx();
    const hid = this.household.activeId();
    if (!t || !hid || this.saving()) return;
    this.saving.set(true);
    try {
      await this.service.delete(hid, t.id);
      this.store.reload();
      this.dialog.close();
      this.toast.success('Buchung gelöscht');
    } catch {
      this.err.set('Löschen fehlgeschlagen.');
    } finally {
      this.saving.set(false);
    }
  }

  cancel(): void { this.dialog.close(); }

  private centsToDisplay(cents: number): string {
    return (cents / 100).toFixed(2).replace('.', ',');
  }

  private parseCents(value: string): number {
    const n = parseFloat(value.replace(',', '.').replace(/[^0-9.\-]/g, ''));
    return Math.round(n * 100);
  }
}
```

- [ ] **Create `transaction-dialog.component.html`**

```html
<!-- apps/web/src/app/pages/buchungen/transaction-dialog.component.html -->
<div class="form">

  <div class="field">
    <label class="field-label" for="td-desc">Beschreibung</label>
    <input id="td-desc" class="field-input" type="text"
           placeholder="z.B. Supermarkt Rewe"
           [value]="description()"
           (input)="description.set($any($event.target).value)" />
  </div>

  <div class="field">
    <label class="field-label" for="td-amount">Betrag (€, negativ = Ausgabe)</label>
    <input id="td-amount" class="field-input field-input--mono" type="text"
           inputmode="decimal" placeholder="-50,00"
           [value]="amount()"
           (input)="amount.set($any($event.target).value)" />
  </div>

  <div class="field">
    <label class="field-label" for="td-date">Datum</label>
    <input id="td-date" class="field-input" type="date"
           [value]="date()"
           (change)="date.set($any($event.target).value)" />
  </div>

  <div class="field">
    <label class="field-label" for="td-cat">Kategorie</label>
    <select id="td-cat" class="field-select"
            [value]="categoryId()"
            (change)="categoryId.set($any($event.target).value)">
      <option value="" disabled>Kategorie wählen…</option>
      @for (cat of cats.active(); track cat.id) {
        <option [value]="cat.id">{{ cat.name }}</option>
      }
    </select>
  </div>

  <div class="field">
    <label class="field-label" for="td-vis">Sichtbarkeit</label>
    <select id="td-vis" class="field-select"
            [value]="visibility()"
            (change)="visibility.set($any($event.target).value)">
      <option value="SHARED">Geteilt</option>
      <option value="PRIVATE">Privat</option>
    </select>
  </div>

  @if (err()) {
    <p class="err-msg">{{ err() }}</p>
  }

  <div class="actions">
    @if (isEditMode()) {
      <klar-button variant="danger" label="Löschen"
                   [loading]="saving()" (clicked)="remove()" />
    }
    <klar-button variant="ghost" label="Abbrechen" (clicked)="cancel()" />
    <klar-button variant="primary" [label]="isEditMode() ? 'Speichern' : 'Anlegen'"
                 [loading]="saving()" [disabled]="!isValid()"
                 (clicked)="save()" />
  </div>
</div>
```

- [ ] **Create `transaction-dialog.component.css`**

```css
/* apps/web/src/app/pages/buchungen/transaction-dialog.component.css */
.form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.field-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 500;
  color: var(--text-muted);
}

.field-input {
  font-size: 14px;
  font-family: var(--font-sans);
  color: var(--text);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm, 2px);
  padding: 8px 10px;
  outline: none;
  width: 100%;
  box-sizing: border-box;
  transition: border-color 100ms;
}

.field-input:focus {
  border-color: var(--color-accent, #3b82f6);
}

.field-input--mono {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.field-select {
  font-size: 14px;
  font-family: var(--font-sans);
  color: var(--text);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm, 2px);
  padding: 8px 10px;
  outline: none;
  width: 100%;
  box-sizing: border-box;
  cursor: pointer;
  transition: border-color 100ms;
  -webkit-appearance: none;
  appearance: none;
}

.field-select:focus {
  border-color: var(--color-accent, #3b82f6);
}

.err-msg {
  font-size: 13px;
  color: var(--color-expense);
  padding: 8px 12px;
  background: color-mix(in oklab, var(--color-expense) 8%, transparent);
  border-radius: var(--radius-sm, 2px);
  margin: 0;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 4px;
}
```

- [ ] **Build to verify**

```bash
pnpm --filter @klar/web build --configuration=development 2>&1 | grep -E "error|complete"
```

- [ ] **Commit**

```bash
git add apps/web/src/app/pages/buchungen/transaction-dialog.component.ts \
        apps/web/src/app/pages/buchungen/transaction-dialog.component.html \
        apps/web/src/app/pages/buchungen/transaction-dialog.component.css
git commit -m "feat: TransactionDialogComponent — combined create/edit"
```

---

## Task 7 — Wire Buchungen page + brand icons in transaction rows

**Files:**
- Modify: `apps/web/src/app/pages/buchungen/buchungen.component.ts`
- Modify: `apps/web/src/app/pages/buchungen/buchungen.component.html`

The current Buchungen component has `showCreateForm = signal(false)` that is unused in the template. We replace this with `dialogService.open()`.

- [ ] **Rewrite `buchungen.component.ts`**

```ts
// apps/web/src/app/pages/buchungen/buchungen.component.ts
import { Component, computed, inject } from '@angular/core';
import { KlarSkeletonComponent } from '../../shared/ui/klar-skeleton.component';
import { KlarIconComponent } from '../../shared/icons/klar-icon.component';
import { BrandIconComponent } from '../../shared/ui/brand-icon.component';
import { KlarDialogService } from '../../shared/ui/klar-dialog.service';
import { TransactionsStore, Transaction } from '../../core/transactions/transactions.store';
import { PageHeaderService } from '../../core/page-header/page-header.service';
import { TransactionDialogComponent } from './transaction-dialog.component';

@Component({
  selector: 'app-buchungen',
  standalone: true,
  imports: [KlarSkeletonComponent, KlarIconComponent, BrandIconComponent],
  templateUrl: './buchungen.component.html',
  styleUrl: './buchungen.component.css',
})
export class BuchungenPageComponent {
  protected store        = inject(TransactionsStore);
  private dialogService  = inject(KlarDialogService);

  constructor() {
    inject(PageHeaderService).set({
      title:         'Buchungen',
      subtitle:      'MONATLICHE AUSGABEN & EINNAHMEN',
      showPlanspiel: false,
      showAdd:       true,
      addLabel:      'Buchung',
      onAdd:         () => this.openCreate(),
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

  protected readonly displayMonth = computed(() => {
    const [year, month] = this.store.currentMonth().split('-');
    const date = new Date(Number(year), Number(month) - 1, 1);
    return date.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
  });

  formatCents(cents: number): string {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(cents / 100);
  }

  formatDate(dateStr: string): string {
    const parts = dateStr.split('-');
    if (parts.length < 3) return dateStr;
    return `${parts[2]}.${parts[1]}.`;
  }

  prevMonth(): void {
    const [year, month] = this.store.currentMonth().split('-').map(Number);
    const d = new Date(year, month - 2, 1);
    this.store.setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  nextMonth(): void {
    const [year, month] = this.store.currentMonth().split('-').map(Number);
    const d = new Date(year, month, 1);
    this.store.setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
}
```

Note: `Transaction` must be exported from `transactions.store.ts`. Add `export` to the interface if missing:
```ts
// In transactions.store.ts, change:
export interface Transaction { ... }  // add 'export' if not already there
```

- [ ] **Update `buchungen.component.html`** — add brand icon + click handler to tx rows:

Replace the transaction list section (`<div class="tx-list">`) with:

```html
<!-- Transaction list -->
<div class="tx-list">
  @for (tx of store.sortedItems(); track tx.id) {
    <div class="tx-row" (click)="openEdit(tx, $event)">
      <app-brand-icon [name]="tx.description ?? ''" [size]="12" class="tx-brand" />
      <span class="tx-date">{{ formatDate(tx.date) }}</span>

      <span class="tx-info">
        <span class="tx-desc">{{ tx.description }}</span>
        <span class="tx-badges">
          @if (tx.categoryId) {
            <span class="tx-badge">KAT</span>
          }
          @if (tx.visibility === 'PRIVATE') {
            <span class="tx-badge tx-badge-private">PRIVAT</span>
          }
        </span>
      </span>

      <span class="tx-amount" [class.income]="tx.amountCents > 0" [class.expense]="tx.amountCents < 0">
        {{ formatCents(tx.amountCents) }}
      </span>
    </div>
  }
</div>
```

Add `.tx-brand` and cursor to `buchungen.component.css`:

```css
/* Add to buchungen.component.css */
.tx-row {
  cursor: pointer;
}

.tx-brand {
  flex-shrink: 0;
  margin-right: 6px;
}
```

- [ ] **Export `Transaction` from `transactions.store.ts` if needed**

Check `apps/web/src/app/core/transactions/transactions.store.ts` line 7:

```ts
export interface Transaction {  // must have 'export'
```

If `export` is missing, add it.

- [ ] **Build to verify**

```bash
pnpm --filter @klar/web build --configuration=development 2>&1 | grep -E "error|complete"
```

- [ ] **Commit**

```bash
git add apps/web/src/app/pages/buchungen/buchungen.component.ts \
        apps/web/src/app/pages/buchungen/buchungen.component.html \
        apps/web/src/app/pages/buchungen/buchungen.component.css \
        apps/web/src/app/core/transactions/transactions.store.ts
git commit -m "feat: buchungen page — edit/create via dialog, brand icons in rows"
```

---

## Task 8 — Smoke test

- [ ] Open `http://localhost:4200/app/fixkosten`
  - Click any entry → dialog opens with **name, monthly amount, category select, frequency select, Buchungstag** all pre-filled
  - Change category → Save → list reloads with correct category group
  - Change frequency to Yearly → amount field changes label accordingly
  - Brand icon appears in each row (Spotify logo for Spotify, Apple for iCloud, etc.)
  - Unknown vendors show generic tag icon

- [ ] Open `http://localhost:4200/app/buchungen`
  - Click "Buchung" top-bar button → create dialog opens (blank form, today's date)
  - Fill in description "Test", amount "-10,00", pick a category, click "Anlegen" → toast + list reloads with new entry
  - Click the new entry → edit dialog opens pre-filled
  - Click "Löschen" → entry gone
  - Brand icons appear for entries where the description matches (e.g. "Spotify Abo")

- [ ] Escape key closes dialog on both pages ✅

---

## Self-Review

**Spec coverage:**
- ✅ Iconify brand icons — Task 3 + 4 + 7
- ✅ Category editable in recurring dialog — Task 2
- ✅ Frequency editable — Task 2
- ✅ Buchungstag editable — Task 2
- ✅ TransactionDialog reuses all infrastructure (CategoriesStore, KlarDialogService) — Tasks 5–7
- ✅ BrandIconComponent reused in both Fixkosten and Buchungen — Tasks 4 + 7

**No placeholders:** All code blocks are complete.

**Type consistency:**
- `Transaction` imported from `transactions.store.ts` (local type) consistently across Tasks 6 + 7
- `FixedCostItem.categoryId: string` added in Task 1, consumed in Task 2 `effect()`
- `UpdateRecurringTransactionRequest` expanded in Task 2, matches backend Prisma schema fields (`categoryId`, `frequency`, `dayOfMonth`)
- `safeDayOfMonth` imported from `@klar/shared` in Task 2 — exported from `packages/shared/src/calculations.ts` ✅

**Potential issues to watch:**
- `@iconify/angular`'s `IconComponent` selector: verify it renders as `<iconify-icon>` after install. If different, update `brand-icon.component.html`.
- `@iconify-json/simple-icons` JSON import: if TypeScript requires `assert { type: 'json' }`, update the import in `app.config.ts`. Angular CLI's default tsconfig should handle this without the assertion.
- Simple Icons slugs that don't exist in the collection (ADAC, LBS, Sparkasse, all-inkl, Splice) will silently render nothing via Iconify — `BrandIconComponent` falls back to `<klar-icon name="tag">` only when `slug()` is null. Consider adding these to the map with `null` to guarantee the fallback.
