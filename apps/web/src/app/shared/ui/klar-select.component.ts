import {
  ChangeDetectionStrategy,
  Component,
  computed,
  forwardRef,
  input,
  model,
} from '@angular/core';
import { FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import {
  BrnSelectComponent,
  BrnSelectContentComponent,
  BrnSelectOptionDirective,
  BrnSelectScrollDownDirective,
  BrnSelectScrollUpDirective,
  BrnSelectTriggerDirective,
  BrnSelectValueComponent,
} from '@spartan-ng/ui-select-brain';
import { KlarIconComponent } from '../icons/klar-icon.component';
import { hlm } from './hlm/hlm-utils';

export interface KlarSelectOption<TValue extends string = string> {
  value: TValue;
  label: string;
  disabled?: boolean;
}

/**
 * Spartan-backed select dropdown. Replaces every native `<select hlmSelect>` in
 * the app — gives proper dark-mode styling, keyboard navigation, ARIA wiring,
 * and a stylable trigger/options panel.
 *
 * Options are passed as data (not content-projected) because brn-select-option
 * needs the CdkListbox injector from `<brn-select-content>`, which content
 * projection doesn't preserve.
 *
 *   <klar-select [(value)]="frequency" placeholder="Häufigkeit" [options]="freqOpts" />
 *
 *   freqOpts: KlarSelectOption[] = [
 *     { value: 'WEEKLY',  label: 'Wöchentlich' },
 *     { value: 'MONTHLY', label: 'Monatlich' },
 *   ];
 */
@Component({
  selector: 'klar-select',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    BrnSelectComponent,
    BrnSelectTriggerDirective,
    BrnSelectValueComponent,
    BrnSelectContentComponent,
    BrnSelectOptionDirective,
    BrnSelectScrollUpDirective,
    BrnSelectScrollDownDirective,
    KlarIconComponent,
  ],
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => KlarSelectComponent), multi: true },
  ],
  template: `
    <brn-select
      [placeholder]="placeholder()"
      [disabled]="disabled()"
      [ngModel]="value()"
      (ngModelChange)="onChange($event)"
    >
      <button
        type="button"
        brnSelectTrigger
        [class]="_triggerCls()"
        [attr.aria-label]="ariaLabel() ?? placeholder() ?? null"
      >
        <brn-select-value class="truncate text-left flex-1" />
        <klar-icon name="chevron-down" [size]="14" class="opacity-60 shrink-0" />
      </button>

      <brn-select-content [class]="_contentCls()">
        <!-- Required scroll-direction children: BrnSelectContentComponent
             defines them as contentChild.required() so omitting them
             throws NG0951 on every render. Spartan's helm wrappers ship
             these for you; in this slim wrapper we provide invisible
             stubs — the content panel's own template only renders the
             visible scroll button when canScroll() is true. -->
        <span brnSelectScrollUp class="hidden" aria-hidden="true"></span>
        @for (opt of options(); track opt.value) {
          <button
            type="button"
            brnOption
            [value]="opt.value"
            [disabled]="opt.disabled ?? false"
            [class]="_optionCls()"
          >
            {{ opt.label }}
          </button>
        }
        <span brnSelectScrollDown class="hidden" aria-hidden="true"></span>
      </brn-select-content>
    </brn-select>
  `,
})
export class KlarSelectComponent<TValue extends string = string> {
  readonly value = model<TValue | ''>('' as TValue | '');
  readonly options = input.required<readonly KlarSelectOption<TValue>[]>();
  readonly placeholder = input<string>('');
  readonly disabled = input(false);
  readonly ariaLabel = input<string | null>(null);
  readonly userClass = input('', { alias: 'class' });

  protected readonly _triggerCls = computed(() =>
    hlm(
      'inline-flex items-center justify-between gap-2 w-full',
      'h-8 rounded border border-(--border) bg-(--surface) px-3 text-base text-(--text)',
      'focus-visible:outline-none focus-visible:border-(--accent)/60 focus-visible:ring-1 focus-visible:ring-(--accent)/40',
      'disabled:cursor-not-allowed disabled:opacity-50',
      'transition-colors cursor-pointer',
      this.userClass(),
    ),
  );

  protected readonly _contentCls = computed(() =>
    hlm(
      'block max-h-96 min-w-[8rem] overflow-y-auto overflow-x-hidden',
      'rounded-md border border-border bg-popover text-popover-foreground shadow-md',
      'p-1 outline-none',
    ),
  );

  protected readonly _optionCls = computed(() =>
    hlm(
      'relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-3 pr-8 text-sm text-left',
      'outline-none transition-colors bg-transparent border-0',
      'data-[active]:bg-accent data-[active]:text-accent-foreground',
      'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      'aria-[selected=true]:bg-accent/60 aria-[selected=true]:font-medium',
    ),
  );

  // ControlValueAccessor — minimal pass-through so klar-select can be used with
  // either [(value)] (signal model) or [(ngModel)]/Reactive Forms.
  private _onChange: (v: TValue | '') => void = () => {};
  private _onTouched: () => void = () => {};

  writeValue(v: TValue | null | undefined): void {
    this.value.set((v ?? '') as TValue | '');
  }
  registerOnChange(fn: (v: TValue | '') => void): void {
    this._onChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this._onTouched = fn;
  }
  setDisabledState(): void {
    /* signal-based input; controlled by parent */
  }

  onChange(v: TValue | ''): void {
    this.value.set(v);
    this._onChange(v);
    this._onTouched();
  }
}
