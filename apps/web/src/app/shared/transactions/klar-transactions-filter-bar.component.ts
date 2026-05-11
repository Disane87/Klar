import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { KlarInputComponent } from '../ui/klar-input.component';
import { KlarSelectComponent, type KlarSelectOption } from '../ui/klar-select.component';
import { KlarToggleGroupComponent, type KlarToggleOption } from '../ui/klar-toggle-group.component';
import { KlarButtonComponent } from '../ui/klar-button.component';
import {
  type AmountFilter,
  type SourceFilter,
  type TransactionFilters,
} from './transaction-filters';
import { formatBookingText } from './format-booking-text';

export type LockableFilterKey = 'accountId' | 'categoryId' | 'source' | 'amount';

@Component({
  selector: 'klar-transactions-filter-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    KlarInputComponent,
    KlarSelectComponent,
    KlarToggleGroupComponent,
    KlarButtonComponent,
  ],
  template: `
    <div class="flex flex-col md:flex-row md:items-end gap-2">
      <div class="flex-1 min-w-0">
        <klar-input
          type="search"
          placeholder="Beschreibung, Empfänger oder Verwendungszweck …"
          iconName="search"
          [ngModel]="filters().search"
          (ngModelChange)="patch({ search: $event })"
        />
      </div>

      @if (accountOptions().length > 0) {
        <div [attr.data-filter]="'accountId'" [attr.data-locked]="isLocked('accountId')">
          <klar-select
            [options]="accountOptionsWithAll()"
            [value]="filters().accountId ?? '__all__'"
            [disabled]="isLocked('accountId')"
            (valueChange)="onAccountChange($event)"
          />
        </div>
      }

      @if (!isLocked('amount')) {
        <klar-toggle-group
          [options]="amountOptions"
          [value]="filters().amount"
          (valueChange)="onAmountChange($event)"
        />
      }
      @if (!isLocked('source')) {
        <klar-toggle-group
          [options]="sourceOptions"
          [value]="filters().source"
          (valueChange)="onSourceChange($event)"
        />
      }

      @if (bookingTextOptionsWithAll().length > 1) {
        <klar-select
          [options]="bookingTextOptionsWithAll()"
          [value]="filters().bookingText ?? '__all__'"
          (valueChange)="onBookingTextChange($event)"
        />
      }

      @if (showReset()) {
        <klar-button tone="ghost" size="sm" icon="x" (click)="resetClick.emit()">
          Filter zurücksetzen
        </klar-button>
      }
    </div>
  `,
})
export class KlarTransactionsFilterBarComponent {
  readonly filters = input.required<TransactionFilters>();
  readonly lockedKeys = input<readonly LockableFilterKey[]>([]);
  readonly accountOptions = input<readonly KlarSelectOption<string>[]>([]);
  readonly showReset = input<boolean>(false);
  /**
   * Distinct bookingText values present in the current dataset. Empty list
   * hides the picker — manual-only households without bank imports won't
   * see this filter.
   */
  readonly bookingTextOptions = input<readonly string[]>([]);

  readonly filtersChange = output<TransactionFilters>();
  readonly resetClick = output<void>();

  protected readonly amountOptions: readonly KlarToggleOption<AmountFilter>[] = [
    { value: 'all', label: 'Alle' },
    { value: 'income', label: 'Eingang' },
    { value: 'expense', label: 'Ausgang' },
  ];

  protected readonly sourceOptions: readonly KlarToggleOption<SourceFilter>[] = [
    { value: 'all', label: 'Alle Quellen' },
    { value: 'fints', label: 'FinTS' },
    { value: 'manual', label: 'Manuell' },
    { value: 'csv', label: 'CSV' },
  ];

  protected readonly accountOptionsWithAll = computed<readonly KlarSelectOption<string>[]>(() => [
    { value: '__all__', label: 'Alle Konten' },
    ...this.accountOptions(),
  ]);

  protected readonly bookingTextOptionsWithAll = computed<readonly KlarSelectOption<string>[]>(() => {
    const opts = this.bookingTextOptions();
    if (opts.length === 0) return [];
    return [
      { value: '__all__', label: 'Alle Buchungsarten' },
      ...opts.map(v => ({ value: v, label: formatBookingText(v) })),
    ];
  });

  protected isLocked(key: LockableFilterKey): boolean {
    return this.lockedKeys().includes(key);
  }

  protected patch(partial: Partial<TransactionFilters>): void {
    this.filtersChange.emit({ ...this.filters(), ...partial });
  }

  protected onAccountChange(value: string | ''): void {
    this.patch({ accountId: !value || value === '__all__' ? null : value });
  }

  protected onAmountChange(value: AmountFilter | ''): void {
    this.patch({ amount: (value || 'all') as AmountFilter });
  }

  protected onSourceChange(value: SourceFilter | ''): void {
    this.patch({ source: (value || 'all') as SourceFilter });
  }

  protected onBookingTextChange(value: string | ''): void {
    this.patch({ bookingText: !value || value === '__all__' ? null : value });
  }
}
