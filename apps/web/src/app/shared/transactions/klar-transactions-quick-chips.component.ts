import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { type TransactionFilters } from './transaction-filters';

interface ChipDef {
  label: string;
  isActive: (f: TransactionFilters) => boolean;
  apply: (f: TransactionFilters) => TransactionFilters;
  clear: (f: TransactionFilters) => TransactionFilters;
}

const CHIPS: readonly ChipDef[] = [
  {
    label: 'Wiederkehrend',
    isActive: f => f.recurring === 'recurring',
    apply: f => ({ ...f, recurring: 'recurring' }),
    clear: f => ({ ...f, recurring: 'all' }),
  },
  {
    label: 'Eingänge',
    isActive: f => f.amount === 'income',
    apply: f => ({ ...f, amount: 'income' }),
    clear: f => ({ ...f, amount: 'all' }),
  },
  {
    label: 'FinTS',
    isActive: f => f.source === 'fints',
    apply: f => ({ ...f, source: 'fints' }),
    clear: f => ({ ...f, source: 'all' }),
  },
  {
    label: 'Manuell',
    isActive: f => f.source === 'manual',
    apply: f => ({ ...f, source: 'manual' }),
    clear: f => ({ ...f, source: 'all' }),
  },
];

@Component({
  selector: 'klar-transactions-quick-chips',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex items-center gap-2 overflow-x-auto pb-1 -mx-(--s-1) px-(--s-1)">
      @for (chip of chips; track chip.label) {
        <button type="button" [class]="chipClass(chip)" (click)="onToggle(chip)">
          {{ chip.label }}
        </button>
      }
    </div>
  `,
})
export class KlarTransactionsQuickChipsComponent {
  readonly filters = input.required<TransactionFilters>();
  readonly filtersChange = output<TransactionFilters>();

  protected readonly chips = CHIPS;

  protected chipClass(chip: ChipDef): string {
    const base = 'shrink-0 px-3 py-1.5 rounded-full border text-[12px] transition-colors';
    return chip.isActive(this.filters())
      ? `${base} bg-(--bg-3) text-(--fg) border-(--line)`
      : `${base} bg-transparent text-(--fg-2) border-(--line)`;
  }

  protected onToggle(chip: ChipDef): void {
    const current = this.filters();
    const next = chip.isActive(current) ? chip.clear(current) : chip.apply(current);
    this.filtersChange.emit(next);
  }
}
