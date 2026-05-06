import { Component, computed, inject, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { KlarSkeletonComponent } from '../../shared/ui/klar-skeleton.component';
import { BrandIconComponent } from '../../shared/ui/brand-icon.component';
import { KlarDialogService } from '../../shared/ui/klar-dialog.service';
import { TransactionsStore, Transaction } from '../../core/transactions/transactions.store';
import { CategoriesStore } from '../../core/categories/categories.store';
import { PageHeaderService } from '../../core/page-header/page-header.service';
import { TransactionDialogComponent } from './transaction-dialog.component';
import { KlarMoneyPipe } from '../../shared/pipes/klar-money.pipe';
import { KlarMoneyClassPipe } from '../../shared/pipes/klar-money-class.pipe';
import { KlarErrorBarComponent } from '../../shared/ui/klar-error-bar.component';
import { KlarEmptyStateComponent } from '../../shared/ui/klar-empty-state.component';
import { KlarMonthPickerComponent } from '../../shared/ui/klar-month-picker.component';
import { KlarSkeletonRowsComponent } from '../../shared/ui/klar-skeleton-rows.component';
import { KlarSummaryStripComponent } from '../../shared/ui/klar-summary-strip.component';
import {
  KlarListComponent,
  KlarListGroupComponent,
  KlarListRowComponent,
} from '../../shared/ui/klar-list.component';

const TYPE_ORDER: Record<string, number> = {
  FIXED_INCOME: 0,
  VARIABLE_INCOME: 1,
  INCOME: 1,
  FIXED_EXPENSE: 2,
  VARIABLE_EXPENSE: 3,
  EXPENSE: 3,
  SAVINGS: 4,
};

interface TxGroup {
  categoryId: string | null;
  categoryName: string;
  categoryColor: string;
  categoryType: string;
  categorySortOrder: number;
  totalCents: number;
  items: Transaction[];
}

@Component({
  selector: 'app-buchungen',
  standalone: true,
  host: { class: 'flex flex-col flex-1 min-h-0 overflow-hidden' },
  imports: [
    NgClass,
    KlarSkeletonComponent,
    BrandIconComponent,
    KlarMoneyPipe,
    KlarMoneyClassPipe,
    KlarErrorBarComponent,
    KlarEmptyStateComponent,
    KlarMonthPickerComponent,
    KlarSkeletonRowsComponent,
    KlarSummaryStripComponent,
    KlarListComponent,
    KlarListGroupComponent,
    KlarListRowComponent,
  ],
  templateUrl: './buchungen.component.html',
  styleUrl: './buchungen.component.css',
})
export class BuchungenPageComponent {
  protected store         = inject(TransactionsStore);
  private categoriesStore = inject(CategoriesStore);
  private dialogService   = inject(KlarDialogService);

  constructor() {
    inject(PageHeaderService).set({
      title:         'Buchungen',
      subtitle:      'MONATLICHE AUSGABEN & EINNAHMEN',
      showPlanspiel: false,
      showAdd:       true,
      addLabel:      'Buchung',
      onAdd:         () => this.openCreate(),
    });
  }

  readonly groups = computed<TxGroup[]>(() => {
    const items = this.store.sortedItems();
    const byCat = new Map<string, Category>();
    for (const c of this.categoriesStore.all()) byCat.set(c.id, c);

    const grouped = new Map<string, TxGroup>();
    for (const tx of items) {
      const key = tx.categoryId ?? '__none__';
      let group = grouped.get(key);
      if (!group) {
        const cat = tx.categoryId ? byCat.get(tx.categoryId) : null;
        group = {
          categoryId: tx.categoryId,
          categoryName: cat?.name ?? 'Ohne Kategorie',
          categoryColor: cat?.color ?? '#6b7280',
          categoryType: cat?.type ?? (tx.amountCents >= 0 ? 'INCOME' : 'EXPENSE'),
          categorySortOrder: cat?.sortOrder ?? 999,
          totalCents: 0,
          items: [],
        };
        grouped.set(key, group);
      }
      group.items.push(tx);
      group.totalCents += tx.amountCents;
    }

    return [...grouped.values()].sort((a, b) => {
      const ta = TYPE_ORDER[a.categoryType] ?? 9;
      const tb = TYPE_ORDER[b.categoryType] ?? 9;
      if (ta !== tb) return ta - tb;
      return a.categorySortOrder - b.categorySortOrder;
    });
  });

  openCreate(): void {
    this.dialogService.open({
      title:     'Buchung anlegen',
      component: TransactionDialogComponent,
      inputs:    { tx: null },
      width:     'sm',
    });
  }

  openEdit(tx: Transaction): void {
    this.dialogService.open({
      title:     'Buchung bearbeiten',
      component: TransactionDialogComponent,
      inputs:    { tx },
      width:     'sm',
    });
  }

  formatDate(dateStr: string): string {
    const parts = dateStr.split('-');
    if (parts.length < 3) return dateStr;
    return `${parts[2]}.${parts[1]}.`;
  }

  readonly collapsedGroups = signal(new Set<string>());

  toggleGroup(key: string): void {
    this.collapsedGroups.update(set => {
      const next = new Set(set);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  isCollapsed(key: string): boolean {
    return this.collapsedGroups().has(key);
  }

  groupKey(g: TxGroup): string {
    return g.categoryId ?? '__none__';
  }

  primaryLabel(tx: Transaction): string {
    return tx.counterparty?.trim() || tx.description?.trim() || '—';
  }

  formatSublabel(tx: Transaction): string {
    const parts: string[] = [this.formatDate(tx.date)];
    if (tx.counterparty?.trim() && tx.description?.trim() && tx.description !== tx.counterparty) {
      parts.push(tx.description);
    }
    if (tx.isPlanned) parts.push('geplant');
    if (tx.visibility === 'PRIVATE') parts.push('privat');
    return parts.join(' · ');
  }
}

interface Category {
  id: string;
  name: string;
  color: string;
  type: string;
  sortOrder: number;
}
