import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';
import { KlarEmptyStateComponent } from '../ui/klar-empty-state.component';
import { KlarIconComponent } from '../icons/klar-icon.component';
import { KlarToggleGroupComponent, type KlarToggleOption } from '../ui/klar-toggle-group.component';
import { KlarTransactionsRowComponent } from './klar-transactions-row.component';
import { KlarTransactionsFilterBarComponent, type LockableFilterKey } from './klar-transactions-filter-bar.component';
import { KlarTransactionsQuickChipsComponent } from './klar-transactions-quick-chips.component';
import { type KlarSelectOption } from '../ui/klar-select.component';

export interface BulkVisibilityChange {
  ids: readonly string[];
  visibility: 'PRIVATE' | 'SHARED';
}
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
    KlarIconComponent,
    KlarToggleGroupComponent,
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
        [bookingTextOptions]="distinctBookingTexts()"
        [showReset]="isFiltered()"
        (filtersChange)="onFiltersChange($event)"
        (resetClick)="onReset()"
      />

      @if (selectedCount() > 0) {
        <div
          class="sticky top-0 z-20 -mx-(--s-6) md:mx-0 px-(--s-6) md:px-4 py-2 flex items-center justify-between gap-3 border-y border-(--line-soft) bg-(--bg-2)"
        >
          <div class="flex items-center gap-3 text-[12px] text-(--fg-2)">
            <span class="mono tabular-nums">{{ selectedCount() }} ausgewählt</span>
            <button
              type="button"
              class="text-[11px] underline-offset-2 hover:underline text-(--fg-3) min-h-6"
              (click)="onClearSelection()"
            >
              Auswahl aufheben
            </button>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-[10px] uppercase tracking-widest text-muted-foreground max-md:hidden">Sichtbarkeit</span>
            <klar-toggle-group
              [options]="visibilityOptions"
              [value]="effectiveSelectedVisibility()"
              (valueChange)="onBulkVisibility($event)"
            />
          </div>
        </div>
      }

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
                <klar-transactions-row
                  [tx]="t"
                  [selectable]="selectable()"
                  [selected]="isSelected(t.id)"
                  (rowClick)="onRowClick($event)"
                  (selectionToggle)="onSelectionToggle($event)"
                />
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
  /** When true, rows show a leading checkbox and the bulk-action toolbar appears on selection. */
  readonly selectable = input<boolean>(true);

  readonly rowClick = output<Transaction>();
  readonly bulkVisibilityChange = output<BulkVisibilityChange>();

  readonly filters = signal<TransactionFilters>(EMPTY_FILTERS);
  private readonly selectedIds = signal<ReadonlySet<string>>(new Set());

  protected readonly visibilityOptions: readonly KlarToggleOption<'PRIVATE' | 'SHARED'>[] = [
    { value: 'PRIVATE', label: 'Privat' },
    { value: 'SHARED', label: 'Geteilt' },
  ];

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

  /**
   * Distinct bookingText values present in the dataset (case-insensitive,
   * sorted alphabetically by their display label). Empty when no row carries
   * a bookingText — manual-only households simply won't see the filter.
   */
  readonly distinctBookingTexts = computed<readonly string[]>(() => {
    const map = new Map<string, string>();
    for (const t of this.transactions()) {
      const v = t.bookingText?.trim();
      if (!v) continue;
      const key = v.toLowerCase();
      if (!map.has(key)) map.set(key, v);
    }
    return [...map.values()].sort((a, b) => a.localeCompare(b, 'de-DE'));
  });

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

  isSelected = (id: string): boolean => this.selectedIds().has(id);

  readonly selectedCount = computed(() => this.selectedIds().size);

  /**
   * Visibility value pre-filled in the segmented control: the unique value
   * if every selected row shares one, otherwise `null` so neither toggle
   * is highlighted (mixed state). The user's click always sets the chosen
   * value on the full selection.
   */
  readonly effectiveSelectedVisibility = computed<'PRIVATE' | 'SHARED' | null>(() => {
    const ids = this.selectedIds();
    if (ids.size === 0) return null;
    let unique: 'PRIVATE' | 'SHARED' | null = null;
    for (const t of this.transactions()) {
      if (!ids.has(t.id)) continue;
      const v = t.visibility;
      if (v !== 'PRIVATE' && v !== 'SHARED') continue;
      if (unique === null) unique = v;
      else if (unique !== v) return null;
    }
    return unique;
  });

  onSelectionToggle(id: string): void {
    this.selectedIds.update(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  onClearSelection(): void {
    this.selectedIds.set(new Set());
  }

  onBulkVisibility(value: 'PRIVATE' | 'SHARED' | null): void {
    if (value !== 'PRIVATE' && value !== 'SHARED') return;
    const ids = [...this.selectedIds()];
    if (ids.length === 0) return;
    this.bulkVisibilityChange.emit({ ids, visibility: value });
    this.selectedIds.set(new Set());
  }

  protected formatCents(cents: number): string {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(cents / 100);
  }
}
