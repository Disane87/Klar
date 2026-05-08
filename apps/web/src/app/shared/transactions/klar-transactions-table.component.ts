import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';
import { KlarEmptyStateComponent } from '../ui/klar-empty-state.component';
import { KlarTransactionsRowComponent } from './klar-transactions-row.component';
import { KlarTransactionsFilterBarComponent, type LockableFilterKey } from './klar-transactions-filter-bar.component';
import { KlarTransactionsQuickChipsComponent } from './klar-transactions-quick-chips.component';
import { type KlarSelectOption } from '../ui/klar-select.component';
import {
  EMPTY_FILTERS,
  applyFilters,
  mergeFilters,
  type TransactionFilters,
} from './transaction-filters';
import { groupByMonth } from './transaction-month-grouping';
import type { Transaction } from '../../core/transactions/transactions.store';

@Component({
  selector: 'klar-transactions-table',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    KlarEmptyStateComponent,
    KlarTransactionsRowComponent,
    KlarTransactionsFilterBarComponent,
    KlarTransactionsQuickChipsComponent,
  ],
  template: `
    <div class="flex flex-col gap-3 md:min-h-0 md:flex-1">
      <klar-transactions-quick-chips
        [filters]="filters()"
        (filtersChange)="onFiltersChange($event)"
      />

      <klar-transactions-filter-bar
        [filters]="filters()"
        [lockedKeys]="lockedKeys()"
        [accountOptions]="accountOptions()"
        [showReset]="isFiltered()"
        (filtersChange)="onFiltersChange($event)"
        (resetClick)="onReset()"
      />

      @if (visibleTransactions().length === 0) {
        <klar-empty-state
          icon="search"
          message="Keine Buchungen passen zum Filter."
        />
      } @else {
        <!-- Mobile: list grows freely so the document scrolls. -->
        <!-- Desktop (md+): inner panel with its own scroll + sticky month headers. -->
        <div class="rounded-md border border-(--line-soft) bg-(--bg-1) md:overflow-hidden flex flex-col">
          <div class="md:overflow-y-auto md:max-h-[clamp(360px,calc(100dvh-360px),720px)]">
            @for (group of monthlyGroups(); track group.key) {
              <div class="sticky top-0 z-10 px-4 py-2 border-b border-(--line-soft) bg-(--bg-2) flex items-center justify-between gap-3">
                <span class="text-[10px] uppercase tracking-widest text-muted-foreground">
                  {{ group.label }}
                </span>
                <span class="text-[11px] mono tabular-nums text-(--fg-2)">
                  {{ group.itemsCount }} ·
                  <span [class.text-success]="group.totalCents > 0" [class.text-danger]="group.totalCents < 0">
                    {{ formatCents(group.totalCents) }}
                  </span>
                </span>
              </div>
              @for (t of group.items; track t.id) {
                <klar-transactions-row [tx]="t" (rowClick)="onRowClick($event)" />
              }
            }
          </div>
        </div>
        <div class="text-[11px] text-(--fg-3) text-center mono">
          @if (isFiltered()) {
            {{ visibleTransactions().length }} von {{ transactions().length }} Buchung{{ transactions().length === 1 ? '' : 'en' }}
          } @else {
            {{ transactions().length }} Buchung{{ transactions().length === 1 ? '' : 'en' }}
          }
          · {{ monthlyGroups().length }} Monat{{ monthlyGroups().length === 1 ? '' : 'e' }}
        </div>
      }
    </div>
  `,
})
export class KlarTransactionsTableComponent {
  readonly transactions = input.required<readonly Transaction[]>();
  readonly lockedFilters = input<Partial<TransactionFilters>>({});
  readonly accountOptions = input<readonly KlarSelectOption<string>[]>([]);

  readonly rowClick = output<Transaction>();

  readonly filters = signal<TransactionFilters>(EMPTY_FILTERS);

  constructor() {
    // Re-merge whenever lockedFilters changes (route param can update).
    effect(() => {
      const locked = this.lockedFilters();
      this.filters.update(f => mergeFilters(f, locked));
    });
  }

  readonly lockedKeys = computed<readonly LockableFilterKey[]>(() => {
    const locked = this.lockedFilters();
    const keys: LockableFilterKey[] = [];
    if (locked.accountId !== undefined && locked.accountId !== null) keys.push('accountId');
    if (locked.categoryId !== undefined && locked.categoryId !== null) keys.push('categoryId');
    if (locked.source !== undefined && locked.source !== 'all') keys.push('source');
    if (locked.amount !== undefined && locked.amount !== 'all') keys.push('amount');
    return keys;
  });

  readonly visibleTransactions = computed(() =>
    applyFilters(this.transactions(), this.filters()),
  );

  readonly monthlyGroups = computed(() => groupByMonth(this.visibleTransactions()));

  readonly isFiltered = computed(() => {
    const baseline = mergeFilters(EMPTY_FILTERS, this.lockedFilters());
    return JSON.stringify(this.filters()) !== JSON.stringify(baseline);
  });

  onFiltersChange(next: TransactionFilters): void {
    this.filters.set(mergeFilters(next, this.lockedFilters()));
  }

  onReset(): void {
    this.filters.set(mergeFilters(EMPTY_FILTERS, this.lockedFilters()));
  }

  onRowClick(t: Transaction): void {
    this.rowClick.emit(t);
  }

  protected formatCents(cents: number): string {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(cents / 100);
  }
}
