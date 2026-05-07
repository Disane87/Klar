import { Component, computed, inject, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { KlarSkeletonComponent } from '../../shared/ui/klar-skeleton.component';
import { KlarDialogService } from '../../shared/ui/klar-dialog.service';
import { TransactionsStore, Transaction } from '../../core/transactions/transactions.store';
import { PageHeaderService } from '../../core/page-header/page-header.service';
import { TransactionDialogComponent } from './transaction-dialog.component';
import { KlarMoneyPipe } from '../../shared/pipes/klar-money.pipe';
import { KlarMoneyClassPipe } from '../../shared/pipes/klar-money-class.pipe';
import { KlarErrorBarComponent } from '../../shared/ui/klar-error-bar.component';
import { KlarEmptyStateComponent } from '../../shared/ui/klar-empty-state.component';
import { KlarMonthPickerComponent } from '../../shared/ui/klar-month-picker.component';
import { KlarSkeletonRowsComponent } from '../../shared/ui/klar-skeleton-rows.component';
import { KlarSummaryStripComponent } from '../../shared/ui/klar-summary-strip.component';
import { KlarToolbarComponent } from '../../shared/ui/klar-toolbar.component';

type Filter = 'alle' | 'rec' | 'manual' | 'income';

@Component({
  selector: 'app-buchungen',
  standalone: true,
  host: { class: 'flex flex-col flex-1 min-h-0 overflow-hidden' },
  imports: [
    NgClass,
    KlarSkeletonComponent,
    KlarMoneyPipe,
    KlarMoneyClassPipe,
    KlarErrorBarComponent,
    KlarEmptyStateComponent,
    KlarMonthPickerComponent,
    KlarSkeletonRowsComponent,
    KlarSummaryStripComponent,
    KlarToolbarComponent,
  ],
  templateUrl: './buchungen.component.html',
  styleUrl: './buchungen.component.css',
})
export class BuchungenPageComponent {
  protected store       = inject(TransactionsStore);
  private dialogService = inject(KlarDialogService);

  constructor() {
    const ph = inject(PageHeaderService);
    ph.set({
      title:    'Buchungen',
      subtitle: 'Cashflow · Buchungen',
      showAdd:  true,
      showExport: true,
      showUserSwitch: true,
      scopeSegments: [
        { id: 'month', label: 'Mai 2026' },
        { id: 'avg6m', label: 'Schnitt 6 M' },
        { id: 'year',  label: 'Jahr' },
      ],
      scopeValue: 'month',
      addLabel: 'Buchung',
      onAdd:    () => this.openCreate(),
      onExport: () => { /* PDF export wires through TransactionsStore */ },
    });
  }

  readonly filter = signal<Filter>('alle');

  readonly filtered = computed(() => {
    const items = this.store.sortedItems();
    const f = this.filter();
    switch (f) {
      case 'rec':     return items.filter(t => !!t.recurringTransactionId && t.amountCents < 0);
      case 'manual':  return items.filter(t => !t.recurringTransactionId);
      case 'income':  return items.filter(t => t.amountCents > 0);
      case 'alle':    return items;
    }
  });

  readonly filterCounts = computed(() => {
    const items = this.store.sortedItems();
    return {
      alle:    items.length,
      rec:     items.filter(t => !!t.recurringTransactionId && t.amountCents < 0).length,
      manual:  items.filter(t => !t.recurringTransactionId).length,
      income:  items.filter(t => t.amountCents > 0).length,
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

  formatDate(dateStr: string): string {
    const parts = dateStr.split('-');
    if (parts.length < 3) return dateStr;
    return `${parts[2]}.${parts[1]}.`;
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
}
