import { ChangeDetectionStrategy, Component, computed, forwardRef, input, model } from '@angular/core';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import { HlmToggleGroupDirective } from './hlm/hlm-toggle-group.directive';
import { HlmToggleGroupItemDirective } from './hlm/hlm-toggle-group-item.directive';
import { hlm } from './hlm/hlm-utils';

export interface KlarToggleOption<TValue extends string = string> {
  value: TValue;
  label: string;
  disabled?: boolean;
}

/**
 * Spartan-backed segmented toggle group (single-select).
 * Options as data, like `klar-select` — keeps usage symmetric across controls.
 *
 *   <klar-toggle-group [(value)]="theme" [options]="themeOptions" />
 */
@Component({
  selector: 'klar-toggle-group',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HlmToggleGroupDirective, HlmToggleGroupItemDirective],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => KlarToggleGroupComponent),
      multi: true,
    },
  ],
  template: `
    <div
      hlmToggleGroup
      type="single"
      [value]="value()"
      (valueChange)="onChange($event)"
      [class]="_groupCls()"
    >
      @for (opt of options(); track opt.value) {
        <button
          type="button"
          hlmToggleGroupItem
          [value]="opt.value"
          [disabled]="opt.disabled ?? false"
          [class]="_itemCls()"
        >
          {{ opt.label }}
        </button>
      }
    </div>
  `,
})
export class KlarToggleGroupComponent<TValue extends string = string> {
  readonly value = model<TValue | ''>('' as TValue | '');
  readonly options = input.required<readonly KlarToggleOption<TValue>[]>();
  readonly userClass = input('', { alias: 'class' });

  protected readonly _groupCls = computed(() =>
    hlm('rounded bg-(--bg-2) p-0.5 gap-0.5', this.userClass()),
  );

  protected readonly _itemCls = computed(() =>
    hlm(
      'inline-flex items-center justify-center whitespace-nowrap rounded-sm font-medium',
      'h-7 min-h-0 px-2.5 text-xs gap-1.5 border',
      'transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-(--accent)/40',
      'disabled:pointer-events-none disabled:opacity-50',
      'data-[state=on]:bg-(--accent-soft) data-[state=on]:text-(--accent) data-[state=on]:border-transparent',
      'data-[state=off]:bg-transparent data-[state=off]:text-(--text-muted) data-[state=off]:border-transparent data-[state=off]:hover:text-(--text) data-[state=off]:hover:bg-(--surface)',
    ),
  );

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
    /* parent-controlled */
  }

  onChange(v: TValue | ''): void {
    this.value.set(v);
    this._onChange(v);
    this._onTouched();
  }
}
