# Spartan UI Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all custom `klar-button`, `klar-input`, `klar-badge`, `klar-dialog`, and native `<select>` controls with Spartan UI (spartan.ng) primitives, keeping the existing design tokens and signal-based patterns intact.

**Architecture:** Install `@spartan-ng/brain` headless packages + `class-variance-authority` for CVA-based styling. Create spartan directive wrappers in `apps/web/src/app/shared/ui/hlm/` that use the project's existing Tailwind v4 CSS tokens. Migrate `klar-dialog` to use Angular CDK `Dialog` service imperatively. Keep `KlarDialogService` API unchanged so call sites remain stable.

**Tech Stack:** Angular 21 (zoneless, signals), Tailwind CSS 4, `@spartan-ng/brain`, `@spartan-ng/ui-dialog-brain`, `@spartan-ng/ui-select-brain`, `class-variance-authority`, `@angular/cdk`

---

## File Structure

### New files (create)
```
apps/web/src/app/shared/ui/hlm/
  hlm-button.directive.ts          — HlmButtonDirective (replaces klar-button)
  hlm-input.directive.ts           — HlmInputDirective (styled <input>)
  hlm-label.directive.ts           — HlmLabelDirective (styled <label>)
  hlm-badge.directive.ts           — HlmBadgeDirective (replaces klar-badge)
  hlm-error.directive.ts           — HlmErrorDirective (inline error text)
  hlm-select/
    hlm-select.component.ts        — <hlm-select> (BrnSelect wrapper)
    hlm-select-trigger.component.ts
    hlm-select-content.component.ts
    hlm-select-item.component.ts
    hlm-select-value.component.ts
  hlm-dialog/
    hlm-dialog-overlay.component.ts   — backdrop/overlay
    hlm-dialog-content.component.ts   — panel wrapper
    hlm-dialog-header.component.ts    — title + close button
```

### Modified files
```
apps/web/src/styles.css                                    — add spartan CSS tokens to @theme
apps/web/src/app/shared/ui/klar-button.component.ts/.html/.css   — replaced by HlmButtonDirective
apps/web/src/app/shared/ui/klar-badge.component.ts/.css          — rewritten to use HlmBadgeDirective
apps/web/src/app/shared/ui/klar-input.component.ts/.html/.css    — internals use HlmInput/Label
apps/web/src/app/shared/ui/klar-dialog.component.ts/.html/.css   — rewritten to use CDK Dialog + hlm-dialog
apps/web/src/app/shared/ui/klar-dialog.service.ts                — add CDK Dialog open()
apps/web/src/app/layout/shell/shell.component.html                — remove <klar-dialog>
apps/web/src/app/layout/shell/shell.component.ts                  — remove KlarDialogComponent import
apps/web/src/app/pages/login/login.component.html/.ts             — klar-button → button[hlmBtn]
apps/web/src/app/pages/register/register.component.html/.ts       — klar-button → button[hlmBtn]
apps/web/src/app/pages/onboarding/onboarding.component.html/.ts  — klar-button → button[hlmBtn]
apps/web/src/app/pages/buchungen/transaction-dialog.component.html/.ts   — selects → HlmSelect
apps/web/src/app/pages/fixkosten/recurring-edit-dialog.component.html/.ts — selects → HlmSelect
CLAUDE.md                                                          — fix stack table entry
```

### Deleted files
```
apps/web/src/app/shared/ui/klar-button.component.ts
apps/web/src/app/shared/ui/klar-button.component.html
apps/web/src/app/shared/ui/klar-button.component.css
apps/web/src/app/shared/ui/klar-button.component.spec.ts
```

---

## Task 1: Install dependencies + extend CSS tokens

**Files:**
- Modify: `apps/web/package.json`
- Modify: `apps/web/src/styles.css`

- [ ] **Step 1: Install spartan brain packages**

```powershell
cd c:\Workspace\Klar
pnpm --filter @klar/web add @spartan-ng/brain @spartan-ng/ui-dialog-brain @spartan-ng/ui-select-brain class-variance-authority clsx tailwind-merge @angular/cdk
```

Expected: packages install without peer-dependency errors. If `@spartan-ng/brain` is not found on npm, install `@spartan-ng/ui-core` instead:
```powershell
pnpm --filter @klar/web add @spartan-ng/ui-core @spartan-ng/ui-dialog-brain @spartan-ng/ui-select-brain class-variance-authority clsx tailwind-merge @angular/cdk
```

Verify: `pnpm --filter @klar/web list class-variance-authority` shows a version.

- [ ] **Step 2: Add missing Tailwind v4 semantic tokens to `apps/web/src/styles.css`**

The spartan directives use Tailwind classes like `bg-primary`, `text-destructive`, `border-input`, etc. Add them to the existing `@theme` block (around line 129).

Find the `@theme {` block and add to it:

```css
/* --- Add INSIDE the existing @theme { } block --- */

  /* Tokens spartan needs */
  --color-border:                 #27272a;
  --color-input:                  #27272a;
  --color-ring:                   #818cf8;

  --color-primary-foreground:     #09090b;
  --color-secondary:              #27272a;
  --color-secondary-foreground:   #fafafa;
  --color-destructive:            #fb7185;
  --color-destructive-foreground: #09090b;
  --color-accent:                 #1f1f23;
  --color-accent-foreground:      #fafafa;
  --color-popover:                #18181b;
  --color-popover-foreground:     #fafafa;
  --color-card-foreground:        #fafafa;
```

After editing, `apps/web/src/styles.css` `@theme` block should look like:

```css
@theme {
  --color-income:   #34d399;
  --color-expense:  #fb7185;
  --color-surplus:  #38bdf8;
  --color-variable: #fbbf24;
  --color-accent:   #818cf8;   /* ← keep existing accent for klar */
  --color-bg:       #09090b;
  --color-surface:  #18181b;
  --color-border:   #27272a;
  --color-font-sans:  'Geist', 'Outfit', system-ui, sans-serif;
  --color-font-mono:  'JetBrains Mono', 'IBM Plex Mono', ui-monospace, monospace;
  --color-font-serif: 'Instrument Serif', 'Iowan Old Style', serif;
  --font-sans:  'Geist', 'Outfit', system-ui, sans-serif;
  --font-mono:  'JetBrains Mono', 'IBM Plex Mono', ui-monospace, monospace;
  --font-serif: 'Instrument Serif', 'Iowan Old Style', serif;

  /* Semantic aliases for spartan.ng compatibility */
  --color-background:             #09090b;
  --color-foreground:             #fafafa;
  --color-card:                   #18181b;
  --color-card-foreground:        #fafafa;
  --color-popover:                #18181b;
  --color-popover-foreground:     #fafafa;
  --color-primary:                #818cf8;
  --color-primary-foreground:     #09090b;
  --color-secondary:              #27272a;
  --color-secondary-foreground:   #fafafa;
  --color-muted:                  #27272a;
  --color-muted-foreground:       #71717a;
  --color-accent:                 #1f1f23;
  --color-accent-foreground:      #fafafa;
  --color-destructive:            #fb7185;
  --color-destructive-foreground: #09090b;
  --color-border:                 #27272a;
  --color-input:                  #27272a;
  --color-ring:                   #818cf8;
  --color-success:                #34d399;
  --color-danger:                 #fb7185;
  --radius: 4px;
}
```

**Note:** `--color-accent` will be overwritten to `#1f1f23` (surface-2 hover tint for spartan). The original klar `--color-accent` (indigo) stays in `:root` as `--color-accent: var(--indigo-400)` for the non-Tailwind usages. The Tailwind class `text-accent` / `bg-accent` will now mean the hover surface.

- [ ] **Step 3: Create the hlm/ directory**

```powershell
New-Item -ItemType Directory -Force -Path "apps\web\src\app\shared\ui\hlm"
New-Item -ItemType Directory -Force -Path "apps\web\src\app\shared\ui\hlm\hlm-select"
New-Item -ItemType Directory -Force -Path "apps\web\src\app\shared\ui\hlm\hlm-dialog"
```

- [ ] **Step 4: Verify build still compiles**

```powershell
pnpm --filter @klar/web build --configuration=development 2>&1 | Select-Object -Last 10
```

Expected: `Application bundle generation complete.` — no errors.

- [ ] **Step 5: Commit**

```powershell
git add apps/web/package.json apps/web/src/styles.css pnpm-lock.yaml
git commit -m "chore: install spartan brain packages + extend Tailwind tokens for spartan"
```

---

## Task 2: HlmButtonDirective (replaces klar-button)

**Files:**
- Create: `apps/web/src/app/shared/ui/hlm/hlm-button.directive.ts`
- Modify: `apps/web/src/app/pages/login/login.component.html`
- Modify: `apps/web/src/app/pages/login/login.component.ts`
- Modify: `apps/web/src/app/pages/register/register.component.html`
- Modify: `apps/web/src/app/pages/register/register.component.ts`
- Modify: `apps/web/src/app/pages/onboarding/onboarding.component.html`
- Modify: `apps/web/src/app/pages/onboarding/onboarding.component.ts`
- Modify: `apps/web/src/app/pages/buchungen/transaction-dialog.component.html`
- Modify: `apps/web/src/app/pages/buchungen/transaction-dialog.component.ts`
- Modify: `apps/web/src/app/pages/fixkosten/recurring-edit-dialog.component.html`
- Modify: `apps/web/src/app/pages/fixkosten/recurring-edit-dialog.component.ts`
- Delete: `apps/web/src/app/shared/ui/klar-button.component.ts`
- Delete: `apps/web/src/app/shared/ui/klar-button.component.html`
- Delete: `apps/web/src/app/shared/ui/klar-button.component.css`
- Delete: `apps/web/src/app/shared/ui/klar-button.component.spec.ts`

- [ ] **Step 1: Create `apps/web/src/app/shared/ui/hlm/hlm-button.directive.ts`**

```typescript
import { Directive, computed, input } from '@angular/core';
import { cva, type VariantProps } from 'class-variance-authority';
import { hlm } from './hlm-utils';

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded text-sm font-medium transition-opacity focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:     'bg-primary text-primary-foreground hover:opacity-90',
        accent:      'bg-[var(--indigo-400)] text-[var(--zinc-950)] hover:opacity-90',
        outline:     'border border-[var(--zinc-700)] bg-transparent text-foreground hover:bg-accent hover:text-accent-foreground',
        ghost:       'border border-border bg-transparent text-foreground hover:bg-accent hover:text-accent-foreground',
        subtle:      'bg-[var(--surface-2)] text-foreground border border-border hover:bg-accent',
        destructive: 'border border-destructive/50 bg-transparent text-destructive hover:bg-destructive/10',
      },
      size: {
        sm: 'h-7 px-2.5 text-xs',
        md: 'h-8 px-3.5 text-sm',
        lg: 'h-9 px-4 text-sm',
      },
    },
    defaultVariants: { variant: 'default', size: 'md' },
  }
);

export type ButtonVariant = NonNullable<VariantProps<typeof buttonVariants>['variant']>;
export type ButtonSize    = NonNullable<VariantProps<typeof buttonVariants>['size']>;

@Directive({
  selector: '[hlmBtn]',
  standalone: true,
  host: { '[class]': '_cls()' },
})
export class HlmButtonDirective {
  variant  = input<ButtonVariant>('default');
  size     = input<ButtonSize>('md');
  userClass = input('', { alias: 'class' });

  _cls = computed(() => hlm(buttonVariants({ variant: this.variant(), size: this.size() }), this.userClass()));
}
```

- [ ] **Step 2: Create `apps/web/src/app/shared/ui/hlm/hlm-utils.ts`** (class merger)

```typescript
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function hlm(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 3: Create a `KlarSpinnerComponent` for loading states**

Create `apps/web/src/app/shared/ui/hlm/hlm-spinner.component.ts`:

```typescript
import { Component, input } from '@angular/core';

@Component({
  selector: 'hlm-spinner',
  standalone: true,
  template: `
    <svg [attr.width]="size()" [attr.height]="size()" viewBox="0 0 24 24"
         class="animate-spin flex-shrink-0" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2.5"
              fill="none" opacity="0.25"/>
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" stroke-width="2.5"
            fill="none" stroke-linecap="round"/>
    </svg>
  `,
})
export class HlmSpinnerComponent {
  size = input(14);
}
```

Also add `animate-spin` to Tailwind — it's built-in, no config needed.

- [ ] **Step 4: Update `login.component.html` — replace klar-button with hlmBtn**

Read `apps/web/src/app/pages/login/login.component.html` first.

Replace the primary submit button (around line 98):
```html
<!-- BEFORE -->
<klar-button
  variant="primary"
  size="lg"
  type="submit"
  label="Anmelden →"
  [fullWidth]="true"
  [loading]="loading()"
  [disabled]="loading()"
  (clicked)="submit()"
/>

<!-- AFTER -->
<button hlmBtn variant="default" size="lg" class="w-full"
        type="submit" [disabled]="loading()" (click)="submit()">
  @if (loading()) { <hlm-spinner [size]="14" /> }
  Anmelden →
</button>
```

Replace the OIDC outline button (around line 114):
```html
<!-- BEFORE -->
<klar-button
  variant="outline"
  size="md"
  iconName="shield"
  [label]="'Mit ' + oidc.providerName() + ' anmelden'"
  [fullWidth]="true"
  [loading]="oidcLoading()"
  [disabled]="loading() || oidcLoading()"
  (clicked)="loginWithOidc()"
/>

<!-- AFTER -->
<button hlmBtn variant="outline" size="md" class="w-full"
        type="button"
        [disabled]="loading() || oidcLoading()"
        (click)="loginWithOidc()">
  @if (oidcLoading()) {
    <hlm-spinner [size]="14" />
  } @else {
    <klar-icon name="shield" [size]="14" />
  }
  Mit {{ oidc.providerName() }} anmelden
</button>
```

- [ ] **Step 5: Update `login.component.ts` — swap imports**

In `apps/web/src/app/pages/login/login.component.ts`:
- Remove import: `KlarButtonComponent`
- Add imports: `HlmButtonDirective`, `HlmSpinnerComponent`, `KlarIconComponent` (if not already there)
- Remove `KlarButtonComponent` from the `imports` array, add `HlmButtonDirective, HlmSpinnerComponent`

- [ ] **Step 6: Update `register.component.html` — replace klar-button**

In `apps/web/src/app/pages/register/register.component.html`, replace the submit button (around line 108):
```html
<!-- BEFORE -->
<klar-button
  variant="primary"
  size="lg"
  type="submit"
  label="Registrieren →"
  [fullWidth]="true"
  [loading]="loading()"
  [disabled]="loading()"
  (clicked)="submit()"
/>

<!-- AFTER -->
<button hlmBtn variant="default" size="lg" class="w-full"
        type="submit" [disabled]="loading()" (click)="submit()">
  @if (loading()) { <hlm-spinner [size]="14" /> }
  Registrieren →
</button>
```

Update `register.component.ts` imports likewise.

- [ ] **Step 7: Update `onboarding.component.html` — replace klar-button**

In `apps/web/src/app/pages/onboarding/onboarding.component.html`, the two `<klar-button>` usages (around lines 71 and 96) become:

```html
<!-- join form -->
<button hlmBtn class="w-full" type="submit" [disabled]="loading()">
  @if (loading()) { <hlm-spinner [size]="14" /> }
  Beitreten
</button>

<!-- create form -->
<button hlmBtn class="w-full" type="submit" [disabled]="loading()">
  @if (loading()) { <hlm-spinner [size]="14" /> }
  Weiter
</button>
```

Update `onboarding.component.ts` imports.

- [ ] **Step 8: Update `transaction-dialog.component.html` — replace klar-button**

In `apps/web/src/app/pages/buchungen/transaction-dialog.component.html`, the three buttons in `.actions` become:

```html
<div class="actions">
  @if (isEditMode()) {
    <button hlmBtn variant="destructive" size="sm"
            [disabled]="saving()" (click)="remove()">
      @if (saving()) { <hlm-spinner [size]="12" /> }
      Löschen
    </button>
  }
  <button hlmBtn variant="ghost" size="sm" (click)="cancel()">Abbrechen</button>
  <button hlmBtn variant="default" size="sm"
          [disabled]="!isValid() || saving()" (click)="save()">
    @if (saving()) { <hlm-spinner [size]="12" /> }
    {{ isEditMode() ? 'Speichern' : 'Anlegen' }}
  </button>
</div>
```

Update `transaction-dialog.component.ts`:
- Remove: `KlarButtonComponent` import
- Add: `HlmButtonDirective, HlmSpinnerComponent`

- [ ] **Step 9: Update `recurring-edit-dialog.component.html` — replace klar-button**

In `apps/web/src/app/pages/fixkosten/recurring-edit-dialog.component.html`, the two buttons become:

```html
<div class="actions">
  <button hlmBtn variant="ghost" size="sm" (click)="cancel()">Abbrechen</button>
  <button hlmBtn variant="default" size="sm"
          [disabled]="!isValid() || saving()" (click)="save()">
    @if (saving()) { <hlm-spinner [size]="12" /> }
    Speichern
  </button>
</div>
```

Update `recurring-edit-dialog.component.ts` imports.

- [ ] **Step 10: Build and verify**

```powershell
pnpm --filter @klar/web build --configuration=development 2>&1 | Select-Object -Last 10
```

Expected: `Application bundle generation complete.` No TypeScript errors.

- [ ] **Step 11: Delete klar-button files**

```powershell
Remove-Item "apps\web\src\app\shared\ui\klar-button.component.ts",
            "apps\web\src\app\shared\ui\klar-button.component.html",
            "apps\web\src\app\shared\ui\klar-button.component.css",
            "apps\web\src\app\shared\ui\klar-button.component.spec.ts"
```

Build again to confirm no dangling references.

- [ ] **Step 12: Commit**

```powershell
git add -A
git commit -m "feat(spartan): replace klar-button with HlmButtonDirective across all pages"
```

---

## Task 3: HlmInputDirective + HlmLabelDirective (update klar-input internals)

**Strategy:** Keep `KlarInputComponent` as an external wrapper (login/register callers unchanged) but rewrite its internals to use spartan directives. Also create standalone `HlmInputDirective` and `HlmLabelDirective` for use in dialog forms.

**Files:**
- Create: `apps/web/src/app/shared/ui/hlm/hlm-input.directive.ts`
- Create: `apps/web/src/app/shared/ui/hlm/hlm-label.directive.ts`
- Create: `apps/web/src/app/shared/ui/hlm/hlm-error.directive.ts`
- Modify: `apps/web/src/app/shared/ui/klar-input.component.html`
- Modify: `apps/web/src/app/shared/ui/klar-input.component.css`
- Modify: `apps/web/src/app/shared/ui/klar-input.component.ts`

- [ ] **Step 1: Create `hlm-input.directive.ts`**

```typescript
import { Directive, computed, input } from '@angular/core';
import { hlm } from './hlm-utils';

@Directive({
  selector: 'input[hlmInput], textarea[hlmInput]',
  standalone: true,
  host: { '[class]': '_cls()' },
})
export class HlmInputDirective {
  userClass = input('', { alias: 'class' });

  _cls = computed(() => hlm(
    'flex w-full rounded border border-input bg-background px-3 text-base',
    'placeholder:text-muted-foreground',
    'focus-visible:outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring',
    'disabled:cursor-not-allowed disabled:opacity-50',
    'transition-colors',
    // iOS: min 16px to prevent auto-zoom
    'text-[1rem]',
    // Heights by context — caller sets h-* via userClass
    'h-9',
    this.userClass()
  ));
}
```

- [ ] **Step 2: Create `hlm-label.directive.ts`**

```typescript
import { Directive, computed, input } from '@angular/core';
import { hlm } from './hlm-utils';

@Directive({
  selector: 'label[hlmLabel]',
  standalone: true,
  host: { '[class]': '_cls()' },
})
export class HlmLabelDirective {
  userClass = input('', { alias: 'class' });

  _cls = computed(() => hlm(
    'text-[9px] font-medium uppercase tracking-widest text-muted-foreground',
    this.userClass()
  ));
}
```

- [ ] **Step 3: Create `hlm-error.directive.ts`**

```typescript
import { Directive } from '@angular/core';

@Directive({
  selector: '[hlmError]',
  standalone: true,
  host: { class: 'text-[11px] text-destructive' },
})
export class HlmErrorDirective {}
```

- [ ] **Step 4: Rewrite `klar-input.component.html`**

Replace entire file content:

```html
<div class="wrapper">
  @if (label()) {
    <label [for]="inputId" hlmLabel>{{ label() }}</label>
  }
  <div class="field" [class.has-error]="error()">
    @if (iconName()) {
      <klar-icon [name]="iconName()!" [size]="14" class="icon" />
    }
    @if (prefix()) {
      <span class="affix klar-mono">{{ prefix() }}</span>
    }
    <input
      hlmInput
      class="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent h-full rounded-none px-0"
      [id]="inputId"
      [type]="type()"
      [placeholder]="placeholder()"
      [disabled]="isDisabled"
      [value]="value"
      (input)="onInput($event)"
      (change)="onInput($event)"
      (blur)="onTouched()"
    />
    @if (suffix()) {
      <span class="affix suffix klar-label-2">{{ suffix() }}</span>
    }
  </div>
  @if (error()) {
    <span hlmError>{{ error() }}</span>
  } @else if (hint()) {
    <span class="hint">{{ hint() }}</span>
  }
</div>
```

- [ ] **Step 5: Update `klar-input.component.ts` imports**

Add `HlmInputDirective, HlmLabelDirective, HlmErrorDirective` to `imports` array. Keep the `ControlValueAccessor` logic unchanged.

```typescript
import { HlmInputDirective } from './hlm/hlm-input.directive';
import { HlmLabelDirective } from './hlm/hlm-label.directive';
import { HlmErrorDirective } from './hlm/hlm-error.directive';

// In @Component decorator:
imports: [KlarIconComponent, HlmInputDirective, HlmLabelDirective, HlmErrorDirective],
```

- [ ] **Step 6: Update `klar-input.component.css`**

Keep the `.wrapper`, `.field`, `.field.has-error`, `.icon`, `.affix` rules. Remove the `input { ... }` block (now handled by `hlmInput`). Keep `.hint`:

```css
.wrapper {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field {
  display: flex;
  align-items: center;
  height: 36px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 0 10px;
  transition: border-color 120ms;
}

.field:focus-within {
  border-color: var(--color-ring);
}

.field.has-error {
  border-color: var(--color-expense);
}

.icon {
  color: var(--text-muted);
  margin-right: 8px;
  flex-shrink: 0;
}

.affix {
  color: var(--text-muted);
  margin-right: 6px;
  flex-shrink: 0;
  font-family: var(--font-mono);
  font-size: var(--body-sm);
}

.suffix {
  margin-right: 0;
  margin-left: 6px;
}

.hint {
  font-size: var(--label-2);
  color: var(--text-muted);
}
```

- [ ] **Step 7: Build and verify**

```powershell
pnpm --filter @klar/web build --configuration=development 2>&1 | Select-Object -Last 10
```

Expected: clean build. If TypeScript complains about `hlmInput` on `<input>`, add `CUSTOM_ELEMENTS_SCHEMA` or check the directive selector matches.

- [ ] **Step 8: Commit**

```powershell
git add -A
git commit -m "feat(spartan): HlmInputDirective + HlmLabelDirective, update klar-input internals"
```

---

## Task 4: HlmBadgeDirective (update klar-badge)

**Files:**
- Create: `apps/web/src/app/shared/ui/hlm/hlm-badge.directive.ts`
- Modify: `apps/web/src/app/shared/ui/klar-badge.component.ts`
- Modify: `apps/web/src/app/shared/ui/klar-badge.component.css`

- [ ] **Step 1: Create `hlm-badge.directive.ts`**

```typescript
import { Directive, computed, input } from '@angular/core';
import { cva, type VariantProps } from 'class-variance-authority';
import { hlm } from './hlm-utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-sm border px-1.5 py-0 text-[9px] font-medium uppercase tracking-widest transition-colors',
  {
    variants: {
      variant: {
        zinc:    'border-border bg-[var(--surface-2)] text-[var(--zinc-300)]',
        emerald: 'border-success/35 bg-success/8 text-success',
        rose:    'border-danger/35 bg-danger/8 text-danger',
        sky:     'border-[var(--color-surplus)]/35 bg-[var(--color-surplus)]/8 text-[var(--color-surplus)]',
        amber:   'border-[var(--color-variable)]/35 bg-[var(--color-variable)]/8 text-[var(--color-variable)]',
        indigo:  'border-[var(--indigo-400)]/35 bg-[var(--indigo-400)]/12 text-[var(--indigo-400)]',
      },
    },
    defaultVariants: { variant: 'zinc' },
  }
);

export type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>['variant']>;

@Directive({
  selector: '[hlmBadge]',
  standalone: true,
  host: { '[class]': '_cls()' },
})
export class HlmBadgeDirective {
  variant  = input<BadgeVariant>('zinc');
  dim      = input(false);
  userClass = input('', { alias: 'class' });

  _cls = computed(() => hlm(
    badgeVariants({ variant: this.variant() }),
    this.dim() ? 'opacity-55' : '',
    this.userClass()
  ));
}
```

- [ ] **Step 2: Rewrite `klar-badge.component.ts`**

Replace file content to use `HlmBadgeDirective` internally and re-export `BadgeVariant` (renamed from `BadgeTone` for backward compat — keep both):

```typescript
import { Component, input } from '@angular/core';
import { HlmBadgeDirective, type BadgeVariant } from './hlm/hlm-badge.directive';

/** @deprecated Use HlmBadgeDirective ([hlmBadge]) directly */
export type BadgeTone = BadgeVariant;

@Component({
  selector: 'klar-badge',
  standalone: true,
  imports: [HlmBadgeDirective],
  template: `<span [hlmBadge]="''" [variant]="tone()" [dim]="dim()"><ng-content /></span>`,
  // host styling removed — now delegated to hlmBadge
  styles: [`:host { display: contents; }`],
})
export class KlarBadgeComponent {
  tone = input<BadgeTone>('zinc');
  dim  = input(false);
}
```

- [ ] **Step 3: Clear `klar-badge.component.css`**

Delete the file content (replaced by hlmBadge classes), leave the file empty or with a comment:

```css
/* Styling delegated to HlmBadgeDirective */
```

- [ ] **Step 4: Build and verify**

```powershell
pnpm --filter @klar/web build --configuration=development 2>&1 | Select-Object -Last 10
```

Expected: clean build.

- [ ] **Step 5: Commit**

```powershell
git add -A
git commit -m "feat(spartan): HlmBadgeDirective, update klar-badge to use spartan variants"
```

---

## Task 5: Spartan Select (HlmSelect — replaces native `<select>`)

**Context:** The dialog forms use native `<select>` elements with `[selected]` option binding. Replace with Spartan's `BrnSelectComponent` which provides keyboard nav, ARIA, and proper Angular signals integration.

**Files:**
- Create: `apps/web/src/app/shared/ui/hlm/hlm-select/hlm-select.component.ts`
- Create: `apps/web/src/app/shared/ui/hlm/hlm-select/hlm-select-trigger.component.ts`
- Create: `apps/web/src/app/shared/ui/hlm/hlm-select/hlm-select-content.component.ts`
- Create: `apps/web/src/app/shared/ui/hlm/hlm-select/hlm-select-item.component.ts`
- Create: `apps/web/src/app/shared/ui/hlm/hlm-select/hlm-select-value.component.ts`
- Create: `apps/web/src/app/shared/ui/hlm/hlm-select/index.ts`
- Modify: `apps/web/src/app/pages/buchungen/transaction-dialog.component.html`
- Modify: `apps/web/src/app/pages/buchungen/transaction-dialog.component.ts`
- Modify: `apps/web/src/app/pages/fixkosten/recurring-edit-dialog.component.html`
- Modify: `apps/web/src/app/pages/fixkosten/recurring-edit-dialog.component.ts`
- Modify: `apps/web/src/app/pages/fixkosten/recurring-edit-dialog.component.css`
- Modify: `apps/web/src/app/pages/buchungen/transaction-dialog.component.css`

- [ ] **Step 1: Verify `@spartan-ng/ui-select-brain` is installed**

```powershell
pnpm --filter @klar/web list @spartan-ng/ui-select-brain 2>&1
```

If not found, it may be part of `@spartan-ng/brain`:
```powershell
pnpm --filter @klar/web list @spartan-ng/brain 2>&1
```

Check what's importable. If neither package resolves `BrnSelectComponent`, use the CDK-based custom select below instead.

- [ ] **Step 2: Create `hlm-select.component.ts`** (root wrapper, applies BrnSelect)

```typescript
import { Component, input, model } from '@angular/core';
import { BrnSelectComponent } from '@spartan-ng/ui-select-brain';
// or: import { BrnSelectComponent } from '@spartan-ng/brain/select';

@Component({
  selector: 'hlm-select',
  standalone: true,
  imports: [BrnSelectComponent],
  template: `
    <brn-select [value]="value()" (valueChange)="value.set($event)">
      <ng-content />
    </brn-select>
  `,
})
export class HlmSelectComponent {
  value = model<string>('');
}
```

**Fallback** if BrnSelectComponent is not available — use a styled native select directive instead:

```typescript
// hlm-select-native.directive.ts
import { Directive } from '@angular/core';

@Directive({
  selector: 'select[hlmSelect]',
  standalone: true,
  host: {
    class: [
      'flex h-9 w-full rounded border border-input bg-background px-3 text-[1rem]',
      'text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
      'disabled:cursor-not-allowed disabled:opacity-50',
    ].join(' '),
  },
})
export class HlmSelectNativeDirective {}
```

Use the fallback if BrnSelectComponent is not resolvable.

- [ ] **Step 3: Create `hlm-select-trigger.component.ts`**

```typescript
import { Component } from '@angular/core';
import { BrnSelectTriggerComponent } from '@spartan-ng/ui-select-brain';

@Component({
  selector: 'hlm-select-trigger',
  standalone: true,
  imports: [BrnSelectTriggerComponent],
  host: {
    class: 'flex h-9 w-full items-center justify-between rounded border border-input bg-background px-3 text-[1rem] text-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
  },
  template: `
    <brn-select-trigger>
      <ng-content />
    </brn-select-trigger>
  `,
})
export class HlmSelectTriggerComponent {}
```

- [ ] **Step 4: Create `hlm-select-content.component.ts`**

```typescript
import { Component } from '@angular/core';
import { BrnSelectContentComponent } from '@spartan-ng/ui-select-brain';

@Component({
  selector: 'hlm-select-content',
  standalone: true,
  imports: [BrnSelectContentComponent],
  host: {
    class: 'absolute z-50 min-w-[8rem] rounded border border-border bg-popover p-1 text-popover-foreground shadow-md',
  },
  template: `
    <brn-select-content>
      <ng-content />
    </brn-select-content>
  `,
})
export class HlmSelectContentComponent {}
```

- [ ] **Step 5: Create `hlm-select-item.component.ts`**

```typescript
import { Component } from '@angular/core';
import { BrnSelectOptionComponent } from '@spartan-ng/ui-select-brain';

@Component({
  selector: 'hlm-option',
  standalone: true,
  imports: [BrnSelectOptionComponent],
  host: {
    class: 'relative flex cursor-default select-none items-center rounded px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
  },
  template: `
    <brn-select-option>
      <ng-content />
    </brn-select-option>
  `,
})
export class HlmOptionComponent {}
```

- [ ] **Step 6: Create `hlm-select/index.ts`** (barrel)

```typescript
export * from './hlm-select.component';
export * from './hlm-select-trigger.component';
export * from './hlm-select-content.component';
export * from './hlm-select-item.component';
```

**NOTE:** If BrnSelect is unavailable, use only `HlmSelectNativeDirective` (the fallback from Step 2) and skip Steps 3-6. In that case, the template pattern for the dialogs is:

```html
<select hlmSelect [value]="categoryId()"
        (change)="categoryId.set($any($event.target).value)">
  <option value="" disabled [selected]="!categoryId()">Kategorie wählen…</option>
  @for (cat of cats.active(); track cat.id) {
    <option [value]="cat.id" [selected]="cat.id === categoryId()">{{ cat.name }}</option>
  }
</select>
```

- [ ] **Step 7: Update `transaction-dialog.component.html`** — replace both native `<select>`

Replace the category select (around line 26):
```html
<!-- BEFORE -->
<div class="field">
  <label class="field-label" for="td-cat">Kategorie</label>
  <select id="td-cat" class="field-select"
          (change)="categoryId.set($any($event.target).value)">
    <option value="" disabled [selected]="!categoryId()">Kategorie wählen…</option>
    @for (cat of cats.active(); track cat.id) {
      <option [value]="cat.id" [selected]="cat.id === categoryId()">{{ cat.name }}</option>
    }
  </select>
</div>

<!-- AFTER (native fallback) -->
<div class="field">
  <label class="field-label" for="td-cat">Kategorie</label>
  <select id="td-cat" hlmSelect
          (change)="categoryId.set($any($event.target).value)">
    <option value="" disabled [selected]="!categoryId()">Kategorie wählen…</option>
    @for (cat of cats.active(); track cat.id) {
      <option [value]="cat.id" [selected]="cat.id === categoryId()">{{ cat.name }}</option>
    }
  </select>
</div>
```

Replace the visibility select (around line 37):
```html
<!-- AFTER -->
<div class="field">
  <label class="field-label" for="td-vis">Sichtbarkeit</label>
  <select id="td-vis" hlmSelect
          (change)="visibility.set($any($event.target).value)">
    <option value="SHARED" [selected]="visibility() === 'SHARED'">Geteilt</option>
    <option value="PRIVATE" [selected]="visibility() === 'PRIVATE'">Privat</option>
  </select>
</div>
```

- [ ] **Step 8: Update `transaction-dialog.component.ts`** imports

Remove CSS-only classes from the `.field-select` style (will be provided by `hlmSelect`), add `HlmSelectNativeDirective` (or full `HlmSelectComponent`) to imports.

- [ ] **Step 9: Update `recurring-edit-dialog.component.html`** — same pattern for category + frequency selects

```html
<!-- Category -->
<select id="red-category" hlmSelect
        (change)="categoryId.set($any($event.target).value)">
  <option value="" disabled [selected]="!categoryId()">Kategorie wählen…</option>
  @for (cat of cats.active(); track cat.id) {
    <option [value]="cat.id" [selected]="cat.id === categoryId()">{{ cat.name }}</option>
  }
</select>

<!-- Frequency -->
<select id="red-freq" hlmSelect
        (change)="frequency.set($any($event.target).value)">
  @for (opt of freqOptions; track opt.value) {
    <option [value]="opt.value" [selected]="opt.value === frequency()">{{ opt.label }}</option>
  }
</select>
```

Update `recurring-edit-dialog.component.ts` and CSS accordingly (remove `.field-select` CSS — handled by `hlmSelect`).

- [ ] **Step 10: Build and verify**

```powershell
pnpm --filter @klar/web build --configuration=development 2>&1 | Select-Object -Last 10
```

Expected: clean build.

- [ ] **Step 11: Commit**

```powershell
git add -A
git commit -m "feat(spartan): HlmSelectNativeDirective, replace native selects in dialog forms"
```

---

## Task 6: Dialog migration — KlarDialogComponent → Angular CDK Dialog + spartan styling

**Strategy:** Keep `KlarDialogService.open()` API 100% unchanged. Implement it using `@angular/cdk/dialog`. Remove `<klar-dialog>` from the shell (CDK handles the overlay portal automatically). Rewrite `KlarDialogComponent` as the content panel styled with spartan dialog classes.

**Files:**
- Modify: `apps/web/src/app/shared/ui/klar-dialog.service.ts`
- Modify: `apps/web/src/app/shared/ui/klar-dialog.component.ts`
- Modify: `apps/web/src/app/shared/ui/klar-dialog.component.html`
- Modify: `apps/web/src/app/shared/ui/klar-dialog.component.css`
- Modify: `apps/web/src/app/layout/shell/shell.component.html`
- Modify: `apps/web/src/app/layout/shell/shell.component.ts`

- [ ] **Step 1: Rewrite `klar-dialog.service.ts`**

```typescript
import { Injectable, Type, inject } from '@angular/core';
import { Dialog, DialogRef } from '@angular/cdk/dialog';
import { KlarDialogComponent } from './klar-dialog.component';

export interface DialogConfig {
  title: string;
  component: Type<unknown>;
  inputs?: Record<string, unknown>;
  width?: 'sm' | 'md' | 'lg';
  disableBackdropClose?: boolean;
}

const WIDTH_MAP = { sm: '400px', md: '520px', lg: '680px' } as const;

@Injectable({ providedIn: 'root' })
export class KlarDialogService {
  private cdk = inject(Dialog);
  private ref: DialogRef<unknown, KlarDialogComponent> | null = null;

  open(config: DialogConfig): void {
    this.close();
    this.ref = this.cdk.open(KlarDialogComponent, {
      data:             { width: 'md', ...config },
      maxWidth:         WIDTH_MAP[config.width ?? 'md'],
      width:            '100%',
      hasBackdrop:      true,
      backdropClass:    'klar-dialog-backdrop',
      panelClass:       'klar-dialog-panel',
      disableClose:     config.disableBackdropClose ?? false,
    });
  }

  close(): void {
    this.ref?.close();
    this.ref = null;
  }
}
```

- [ ] **Step 2: Rewrite `klar-dialog.component.ts`**

The component is now the **content panel** rendered by CDK inside the dialog portal:

```typescript
import { Component, inject, HostListener } from '@angular/core';
import { NgComponentOutlet } from '@angular/common';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { KlarIconComponent } from '../icons/klar-icon.component';
import type { DialogConfig } from './klar-dialog.service';

@Component({
  selector: 'klar-dialog-panel',
  standalone: true,
  imports: [NgComponentOutlet, KlarIconComponent],
  templateUrl: './klar-dialog.component.html',
  styleUrl: './klar-dialog.component.css',
})
export class KlarDialogComponent {
  protected cfg = inject<DialogConfig>(DIALOG_DATA);
  private   ref = inject(DialogRef);

  @HostListener('document:keydown.escape')
  onEscape(): void { this.ref.close(); }

  close(): void { this.ref.close(); }
}
```

- [ ] **Step 3: Rewrite `klar-dialog.component.html`**

```html
<div class="panel">
  <div class="panel-header">
    <span class="panel-title">{{ cfg.title }}</span>
    <button class="close-btn" type="button" title="Schließen" (click)="close()">
      <klar-icon name="x" [size]="14" />
    </button>
  </div>
  <div class="panel-body">
    <ng-container
      [ngComponentOutlet]="cfg.component"
      [ngComponentOutletInputs]="cfg.inputs ?? {}" />
  </div>
</div>
```

- [ ] **Step 4: Rewrite `klar-dialog.component.css`**

```css
.panel {
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  overflow: hidden;
  width: 100%;
  animation: klar-enter 160ms ease-out both;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.panel-title {
  font-size: var(--label);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--text-2);
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: var(--radius);
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-muted);
  transition: color 100ms, background 100ms;
}

.close-btn:hover { color: var(--text); background: var(--surface-2); }

.panel-body {
  padding: 20px;
  overflow-y: auto;
  max-height: calc(100dvh - 120px);
}
```

- [ ] **Step 5: Add global CDK dialog backdrop styles to `styles.css`**

Add at the end of `apps/web/src/styles.css`:

```css
/* ── CDK Dialog backdrop (used by KlarDialogService) ── */
.klar-dialog-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(2px);
  z-index: 999;
  animation: klar-fade 120ms ease-out both;
}

.klar-dialog-panel {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 1000;
  padding: 16px;
  width: 100%;
  box-sizing: border-box;
}
```

- [ ] **Step 6: Remove `<klar-dialog>` from `shell.component.html`**

In `apps/web/src/app/layout/shell/shell.component.html`, delete the line:
```html
<!-- Global dialog outlet -->
<klar-dialog />
```

- [ ] **Step 7: Update `shell.component.ts`**

Remove the `KlarDialogComponent` import and remove it from the `imports` array.

- [ ] **Step 8: Build and verify**

```powershell
pnpm --filter @klar/web build --configuration=development 2>&1 | Select-Object -Last 10
```

Expected: clean build, no references to old `KlarDialogComponent` from shell.

- [ ] **Step 9: Smoke test dialogs work**

Start dev server:
```powershell
Start-Process pwsh -ArgumentList '-NoProfile', '-Command', 'cd c:\Workspace\Klar; pnpm --filter @klar/web dev' -WindowStyle Minimized
```

Open browser → Fixkosten page → click a ledger row → dialog opens with correct CDK backdrop → Escape closes it → click row again → backdrop click closes it. Repeat on Buchungen → "+ Buchung".

- [ ] **Step 10: Commit**

```powershell
git add -A
git commit -m "feat(spartan): migrate dialog to CDK Dialog + spartan panel styling, remove shell outlet"
```

---

## Task 7: Update `transaction-dialog.component.css` + `recurring-edit-dialog.component.css`

The dialog form CSS still has `.field-input`, `.field-select`, `.field-label` hand-written classes. Replace with Tailwind utility classes now that we have `hlmInput`, `hlmSelect`, `hlmBtn`, `hlmLabel` available.

**Files:**
- Modify: `apps/web/src/app/pages/buchungen/transaction-dialog.component.css`
- Modify: `apps/web/src/app/pages/buchungen/transaction-dialog.component.html`
- Modify: `apps/web/src/app/pages/fixkosten/recurring-edit-dialog.component.css`
- Modify: `apps/web/src/app/pages/fixkosten/recurring-edit-dialog.component.html`

- [ ] **Step 1: Replace `.form` / `.field` CSS in `transaction-dialog.component.css`**

New content (CSS variables used for design continuity):

```css
/* Layout only — visual styling via hlmInput/hlmBtn/hlmLabel directives */
.form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-hint {
  font-size: 11px;
  color: var(--text-muted);
}

.err-msg {
  font-size: 12px;
  color: var(--color-expense);
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--border);
}
```

- [ ] **Step 2: Update `transaction-dialog.component.html`** — replace `field-label`, `field-input`, `field-select` classes with spartan directives

Full template:
```html
<div class="form">

  <div class="field">
    <label hlmLabel for="td-desc">Beschreibung</label>
    <input id="td-desc" hlmInput type="text"
           placeholder="z.B. Supermarkt Rewe"
           [value]="description()"
           (input)="description.set($any($event.target).value)" />
  </div>

  <div class="field">
    <label hlmLabel for="td-amount">Betrag (€, negativ = Ausgabe)</label>
    <input id="td-amount" hlmInput class="font-mono tabular-nums" type="text"
           inputmode="decimal" placeholder="-50,00"
           [value]="amount()"
           (input)="amount.set($any($event.target).value)" />
  </div>

  <div class="field">
    <label hlmLabel for="td-date">Datum</label>
    <input id="td-date" hlmInput type="date"
           [value]="date()"
           (change)="date.set($any($event.target).value)" />
  </div>

  <div class="field">
    <label hlmLabel for="td-cat">Kategorie</label>
    <select id="td-cat" hlmSelect
            (change)="categoryId.set($any($event.target).value)">
      <option value="" disabled [selected]="!categoryId()">Kategorie wählen…</option>
      @for (cat of cats.active(); track cat.id) {
        <option [value]="cat.id" [selected]="cat.id === categoryId()">{{ cat.name }}</option>
      }
    </select>
  </div>

  <div class="field">
    <label hlmLabel for="td-vis">Sichtbarkeit</label>
    <select id="td-vis" hlmSelect
            (change)="visibility.set($any($event.target).value)">
      <option value="SHARED" [selected]="visibility() === 'SHARED'">Geteilt</option>
      <option value="PRIVATE" [selected]="visibility() === 'PRIVATE'">Privat</option>
    </select>
  </div>

  @if (err()) {
    <p class="err-msg">{{ err() }}</p>
  }

  <div class="actions">
    @if (isEditMode()) {
      <button hlmBtn variant="destructive" size="sm"
              [disabled]="saving()" (click)="remove()">
        @if (saving()) { <hlm-spinner [size]="12" /> }
        Löschen
      </button>
    }
    <button hlmBtn variant="ghost" size="sm" (click)="cancel()">Abbrechen</button>
    <button hlmBtn variant="default" size="sm"
            [disabled]="!isValid() || saving()" (click)="save()">
      @if (saving()) { <hlm-spinner [size]="12" /> }
      {{ isEditMode() ? 'Speichern' : 'Anlegen' }}
    </button>
  </div>
</div>
```

Update `transaction-dialog.component.ts` imports:
```typescript
imports: [HlmButtonDirective, HlmSpinnerComponent, HlmInputDirective, HlmLabelDirective, HlmSelectNativeDirective]
```
(Remove `KlarButtonComponent`)

- [ ] **Step 3: Do the same for `recurring-edit-dialog.component.html` + `.css`**

New CSS for recurring-edit-dialog (same minimal approach):
```css
.form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-hint {
  font-size: 11px;
  color: var(--text-muted);
}

.err-msg {
  font-size: 12px;
  color: var(--color-expense);
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--border);
}
```

New template:
```html
<div class="form">

  <div class="field">
    <label hlmLabel for="red-name">Name</label>
    <input id="red-name" hlmInput type="text"
           [placeholder]="item().name"
           [value]="name()"
           (input)="name.set($any($event.target).value)" />
  </div>

  <div class="field">
    <label hlmLabel for="red-monthly">Betrag / Monat (€)</label>
    <input id="red-monthly" hlmInput class="font-mono tabular-nums" type="text"
           inputmode="decimal" placeholder="0,00"
           [value]="monthly()"
           (input)="monthly.set($any($event.target).value)" />
    @if (freqHint()) {
      <span class="field-hint">{{ freqHint() }}</span>
    }
  </div>

  <div class="field">
    <label hlmLabel for="red-category">Kategorie</label>
    <select id="red-category" hlmSelect
            (change)="categoryId.set($any($event.target).value)">
      <option value="" disabled [selected]="!categoryId()">Kategorie wählen…</option>
      @for (cat of cats.active(); track cat.id) {
        <option [value]="cat.id" [selected]="cat.id === categoryId()">{{ cat.name }}</option>
      }
    </select>
  </div>

  <div class="field">
    <label hlmLabel for="red-freq">Frequenz</label>
    <select id="red-freq" hlmSelect
            (change)="frequency.set($any($event.target).value)">
      @for (opt of freqOptions; track opt.value) {
        <option [value]="opt.value" [selected]="opt.value === frequency()">{{ opt.label }}</option>
      }
    </select>
  </div>

  <div class="field">
    <label hlmLabel for="red-day">Buchungstag (1–31)</label>
    <input id="red-day" hlmInput class="font-mono tabular-nums" type="number"
           min="1" max="31" placeholder="–"
           [value]="dayOfMonth()"
           (input)="dayOfMonth.set($any($event.target).value)" />
  </div>

  @if (err()) {
    <p class="err-msg">{{ err() }}</p>
  }

  <div class="actions">
    <button hlmBtn variant="ghost" size="sm" (click)="cancel()">Abbrechen</button>
    <button hlmBtn variant="default" size="sm"
            [disabled]="!isValid() || saving()" (click)="save()">
      @if (saving()) { <hlm-spinner [size]="12" /> }
      Speichern
    </button>
  </div>
</div>
```

Update `recurring-edit-dialog.component.ts` imports.

- [ ] **Step 4: Build and verify**

```powershell
pnpm --filter @klar/web build --configuration=development 2>&1 | Select-Object -Last 10
```

Expected: clean build.

- [ ] **Step 5: Commit**

```powershell
git add -A
git commit -m "feat(spartan): migrate dialog form templates to hlmInput/hlmLabel/hlmSelect/hlmBtn"
```

---

## Task 8: Update CLAUDE.md + final cleanup

**Files:**
- Modify: `CLAUDE.md`
- Delete (if still present): any `klar-button` CSS class references in CSS files

- [ ] **Step 1: Update CLAUDE.md stack table**

Find the `| UI Components | Zard UI...` line and replace:

```markdown
| UI Components | Spartan UI (spartan.ng — shadcn/ui for Angular) | pinned — Beta, nie auto-updaten |
```

Also update the Design-System-Regeln section if it references `klar-button` variants. The button variants now are: `default` (= primary), `accent`, `outline`, `ghost`, `subtle`, `destructive`.

- [ ] **Step 2: Build one final time**

```powershell
pnpm --filter @klar/web build --configuration=development 2>&1 | Select-Object -Last 10
```

Expected: `Application bundle generation complete.` — zero TypeScript errors.

- [ ] **Step 3: Run available unit tests**

```powershell
pnpm --filter @klar/web test 2>&1 | Select-Object -Last 20
```

Fix any test failures referencing `KlarButtonComponent` or `klar-button`.

- [ ] **Step 4: Playwright smoke test**

Start dev server and API if not running:
```powershell
Start-Process pwsh -ArgumentList '-NoProfile', '-Command', 'cd c:\Workspace\Klar; pnpm --filter @klar/web dev' -WindowStyle Minimized
```

Check:
- Login page renders with styled inputs and button
- Fixkosten → click ledger row → CDK dialog opens, styled panel
- Buchungen → "+ Buchung" → create dialog opens
- Fill in + Anlegen → toast "Buchung angelegt" → row appears
- Click row → edit dialog opens with all fields pre-filled including category

- [ ] **Step 5: Final commit**

```powershell
git add -A
git commit -m "chore(spartan): update CLAUDE.md stack reference, final cleanup"
```

---

## Self-Review

### Spec coverage
- ✅ `klar-button` replaced by `HlmButtonDirective` — all 5 usage sites updated
- ✅ `klar-input` internals use `HlmInputDirective` + `HlmLabelDirective`
- ✅ `klar-badge` rewritten to use `HlmBadgeDirective`
- ✅ Native `<select>` in dialogs → `HlmSelectNativeDirective` with spartan styling
- ✅ `klar-dialog` → CDK Dialog with spartan panel styling, signal service API unchanged
- ✅ CSS tokens extended for spartan compatibility
- ✅ CLAUDE.md updated

### Parallel execution notes (for ruflo swarm)
- **Tasks 2, 3, 4** are fully independent — button, input, badge can execute concurrently
- **Task 5** (select) and **Task 6** (dialog) are independent of each other but both depend on Task 1
- **Tasks 7, 8** depend on 2, 3, 5 (need hlmBtn, hlmInput, hlmSelect)
- Recommended swarm: 3 agents for Tasks 2+3+4 in parallel, then 2 agents for Tasks 5+6, then sequential 7→8

### Risk: package not found
If `@spartan-ng/ui-select-brain` or `@spartan-ng/brain` doesn't install due to Angular 21 / Tailwind v4 peer conflicts:
- Use the `HlmSelectNativeDirective` fallback (styled native `<select>`) — no brain package needed
- The button and input directives only need `class-variance-authority` + `clsx` + `tailwind-merge` which always install
- Dialog uses only `@angular/cdk/dialog` which is always available
