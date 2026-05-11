import {
  ChangeDetectionStrategy,
  Component,
  computed,
  model,
  signal,
} from '@angular/core';
import { BrnPopoverImports } from '@spartan-ng/brain/popover';
import { KlarIconComponent } from '../icons/klar-icon.component';

const MONTHS_LONG = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];
const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun',
  'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez',
];

/**
 * Compact month/year picker built on Spartan's brn-popover. Trigger is a
 * pill button showing the current month label; clicking opens a popover
 * with year navigation + a 4×3 month grid. Two-way bound via `value`
 * (`YYYY-MM` string) — drop-in for any month-scoped page header.
 */
@Component({
  selector: 'klar-month-select',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BrnPopoverImports, KlarIconComponent],
  host: { class: 'inline-flex' },
  template: `
    <brn-popover align="end" [sideOffset]="6">
      <button
        brnPopoverTrigger
        type="button"
        class="inline-flex items-center gap-1.5 h-8 px-3 rounded-full
               border border-(--line) bg-(--bg-2) text-(--fg)
               text-[12px] font-medium leading-none
               cursor-pointer transition-colors
               hover:bg-(--bg-3) active:opacity-80"
        [attr.aria-label]="'Monat wählen — aktuell ' + label()"
      >
        <span>{{ label() }}</span>
        <klar-icon name="chevron-down" [size]="12" />
      </button>

      <ng-template brnPopoverContent>
        <div
          class="w-64 p-3 rounded-(--r-8) border border-(--line)
                 bg-(--bg-1) shadow-[0_8px_32px_rgba(0,0,0,0.35)]"
        >
          <div class="flex items-center justify-between mb-2">
            <button
              type="button"
              (click)="yearShift(-1)"
              aria-label="Vorheriges Jahr"
              class="size-7 grid place-items-center rounded-md
                     text-(--fg-2) hover:bg-(--bg-2) hover:text-(--fg)
                     cursor-pointer transition-colors"
            >
              <klar-icon name="chevron-left" [size]="14" />
            </button>
            <span
              class="text-[13px] font-medium text-(--fg) font-(family-name:--font-mono) [font-variant-numeric:tabular-nums]"
            >
              {{ viewYear() }}
            </span>
            <button
              type="button"
              (click)="yearShift(1)"
              aria-label="Nächstes Jahr"
              class="size-7 grid place-items-center rounded-md
                     text-(--fg-2) hover:bg-(--bg-2) hover:text-(--fg)
                     cursor-pointer transition-colors"
            >
              <klar-icon name="chevron-right" [size]="14" />
            </button>
          </div>

          <div class="grid grid-cols-3 gap-1">
            @for (m of monthsShort; track $index) {
              <button
                type="button"
                (click)="pick($index)"
                [class.active]="isSelected($index)"
                [class.current]="isCurrent($index)"
                class="h-8 px-2 rounded-md text-[12px] font-medium
                       text-(--fg-2) hover:bg-(--bg-2) hover:text-(--fg)
                       cursor-pointer transition-colors leading-none
                       data-[active=true]:bg-(--accent)
                       data-[active=true]:text-white"
                [attr.data-active]="isSelected($index)"
                [attr.aria-pressed]="isSelected($index)"
              >
                {{ m }}
              </button>
            }
          </div>

          <button
            type="button"
            (click)="pickToday()"
            class="mt-3 w-full h-8 rounded-md text-[11px] font-medium
                   text-(--fg-2) hover:bg-(--bg-2) hover:text-(--fg)
                   border border-(--line) cursor-pointer transition-colors"
          >
            Heute
          </button>
        </div>
      </ng-template>
    </brn-popover>
  `,
})
export class KlarMonthSelectComponent {
  /** Selected month as `YYYY-MM`. Two-way bindable. */
  readonly value = model<string>(currentYearMonth());

  protected readonly monthsShort = MONTHS_SHORT;

  /** Year currently shown in the popover (independent of value, so users
   *  can navigate years without committing yet). */
  protected readonly viewYear = signal<number>(new Date().getFullYear());

  protected readonly selectedYear = computed(() => {
    const [y] = this.value().split('-').map(Number);
    return Number.isFinite(y) ? y : new Date().getFullYear();
  });

  protected readonly selectedMonth0 = computed(() => {
    const [, m] = this.value().split('-').map(Number);
    return Number.isFinite(m) ? Math.max(0, Math.min(11, m - 1)) : new Date().getMonth();
  });

  protected readonly label = computed(() => {
    const y = this.selectedYear();
    const m = this.selectedMonth0();
    return `${MONTHS_LONG[m]} ${y}`;
  });

  constructor() {
    // Keep popover view-year in sync with value when value changes externally.
    queueMicrotask(() => this.viewYear.set(this.selectedYear()));
  }

  protected isSelected(monthIdx: number): boolean {
    return this.viewYear() === this.selectedYear()
        && monthIdx === this.selectedMonth0();
  }

  protected isCurrent(monthIdx: number): boolean {
    const now = new Date();
    return this.viewYear() === now.getFullYear()
        && monthIdx === now.getMonth();
  }

  protected yearShift(delta: number): void {
    this.viewYear.update(y => y + delta);
  }

  protected pick(monthIdx: number): void {
    const ym = `${this.viewYear()}-${String(monthIdx + 1).padStart(2, '0')}`;
    this.value.set(ym);
  }

  protected pickToday(): void {
    this.value.set(currentYearMonth());
    this.viewYear.set(new Date().getFullYear());
  }
}

function currentYearMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
