import { Component, computed, effect, inject, signal } from '@angular/core';
import { KlarSkeletonComponent } from '../../shared/ui/klar-skeleton.component';
import { KlarDialogService } from '../../shared/ui/klar-dialog.service';
import { TransactionsStore, Transaction } from '../../core/transactions/transactions.store';
import { CategoriesStore } from '../../core/categories/categories.store';
import { PageHeaderService } from '../../core/page-header/page-header.service';
import { TransactionDialogComponent } from './transaction-dialog.component';
import { KlarMoneyPipe } from '../../shared/pipes/klar-money.pipe';
import { KlarSummaryStripComponent } from '../../shared/ui/klar-summary-strip.component';
import {
  KlarAsyncStateComponent,
  KlarLoadingTplDirective,
} from '../../shared/ui/klar-async-state.component';
import { KlarIconComponent } from '../../shared/icons/klar-icon.component';

type Filter = 'alle' | 'rec' | 'manual' | 'income';

/**
 * Filter predicates — single source of truth shared between
 * `filtered()` and `filterCounts()`.
 */
const FILTER_PREDICATES: Record<Exclude<Filter, 'alle'>, (t: Transaction) => boolean> = {
  rec:    t => !!t.recurringTransactionId && t.amountCents < 0,
  manual: t => !t.recurringTransactionId,
  income: t => t.amountCents > 0,
};

@Component({
  selector: 'app-buchungen',
  standalone: true,
  host: { class: 'flex flex-col flex-1 min-h-0 overflow-hidden' },
  imports: [
    KlarSkeletonComponent,
    KlarMoneyPipe,
    KlarSummaryStripComponent,
    KlarAsyncStateComponent,
    KlarLoadingTplDirective,
    KlarIconComponent,
  ],
  templateUrl: './buchungen.component.html',
  styleUrl: './buchungen.component.css',
})
export class BuchungenPageComponent {
  protected store          = inject(TransactionsStore);
  private dialogService    = inject(KlarDialogService);
  private categoriesStore  = inject(CategoriesStore);
  private pageHeader       = inject(PageHeaderService);

  constructor() {
    this.pageHeader.set({
      title:    'Buchungen',
      subtitle: 'Cashflow · Buchungen',
      showAdd:  true,
      showExport: false,
      showUserSwitch: true,
      scopeSegments: [
        { id: 'month', label: this.formatMonthLabel(this.store.currentMonth()) },
        { id: 'avg6m', label: 'Schnitt 6 M' },
        { id: 'year',  label: 'Jahr' },
      ],
      scopeValue: 'month',
      addLabel: 'Buchung',
      onAdd:    () => this.openCreate(),
    });

    // Keep the month scope segment label in sync with the active month.
    effect(() => {
      const label = this.formatMonthLabel(this.store.currentMonth());
      this.pageHeader.scopeSegments.set([
        { id: 'month', label },
        { id: 'avg6m', label: 'Schnitt 6 M' },
        { id: 'year',  label: 'Jahr' },
      ]);
    });
  }

  readonly filter = signal<Filter>('alle');

  readonly filtered = computed(() => {
    const items = this.store.sortedItems();
    const f = this.filter();
    if (f === 'alle') return items;
    return items.filter(FILTER_PREDICATES[f]);
  });

  readonly filterCounts = computed(() => {
    const items = this.store.sortedItems();
    return {
      alle:    items.length,
      rec:     items.filter(FILTER_PREDICATES.rec).length,
      manual:  items.filter(FILTER_PREDICATES.manual).length,
      income:  items.filter(FILTER_PREDICATES.income).length,
    };
  });

  setFilter(f: Filter): void {
    this.filter.set(f);
  }

  openCreate(): void {
    this.dialogService.open({
      title:     'Buchung anlegen',
      component: TransactionDialogComponent,
      inputs:    { tx: null },
      width:     'md',
    });
  }

  openEdit(tx: Transaction): void {
    this.dialogService.open({
      title:     'Buchung bearbeiten',
      component: TransactionDialogComponent,
      inputs:    { tx },
      width:     'md',
    });
  }

  formatDayMeta(tx: Transaction): string {
    const dd = tx.date.split('-')[2] ?? '';
    const mm = tx.date.split('-')[1] ?? '';
    const cp = tx.counterparty || tx.description || '';
    return cp ? `${dd}.${mm}. · ${cp}` : `${dd}.${mm}.`;
  }

  primaryLabel(tx: Transaction): string {
    return tx.counterparty?.trim() || tx.description?.trim() || '—';
  }

  categoryColor(tx: Transaction): string {
    const cat = tx.categoryId ? this.categoriesStore.byId(tx.categoryId) : null;
    return cat?.color ?? (tx.amountCents >= 0 ? 'var(--success)' : 'var(--fg-3)');
  }

  rowIcon(tx: Transaction): string {
    if (tx.icon) return tx.icon;
    if (!tx.categoryId) return tx.amountCents > 0 ? 'trending' : 'receipt';
    const cat = this.categoriesStore.byId(tx.categoryId);
    return cat?.icon ?? 'receipt';
  }

  /** Maps `YYYY-MM` to the German long month label, e.g. `Mai 2026`. */
  private formatMonthLabel(yearMonth: string): string {
    const [y, m] = yearMonth.split('-').map(Number);
    if (!y || !m) return yearMonth;
    const date = new Date(Date.UTC(y, m - 1, 1));
    return new Intl.DateTimeFormat('de-DE', {
      month: 'long',
      year:  'numeric',
      timeZone: 'UTC',
    }).format(date);
  }
}
