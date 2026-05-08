import { Component, computed, effect, inject, OnInit } from '@angular/core';
import { KlarSkeletonComponent } from '../../shared/ui/klar-skeleton.component';
import { KlarDialogService } from '../../shared/ui/klar-dialog.service';
import { TransactionsStore, type Transaction } from '../../core/transactions/transactions.store';
import { PageHeaderService } from '../../core/page-header/page-header.service';
import { TransactionDialogComponent } from './transaction-dialog.component';
import { KlarHeroComponent } from '../../shared/ui/klar-hero.component';
import { KlarIconComponent } from '../../shared/icons/klar-icon.component';
import { KlarTileComponent } from '../../shared/ui/klar-tile.component';
import { KlarMoneyPipe } from '../../shared/pipes/klar-money.pipe';
import { HouseholdStore } from '../../core/household/household.store';
import {
  KlarAsyncStateComponent,
  KlarLoadingTplDirective,
} from '../../shared/ui/klar-async-state.component';
import { KlarTransactionsTableComponent } from '../../shared/transactions/klar-transactions-table.component';

@Component({
  selector: 'app-buchungen',
  standalone: true,
  host: { class: 'flex flex-col flex-1 min-h-0 overflow-hidden' },
  imports: [
    KlarSkeletonComponent,
    KlarHeroComponent,
    KlarIconComponent,
    KlarTileComponent,
    KlarMoneyPipe,
    KlarAsyncStateComponent,
    KlarLoadingTplDirective,
    KlarTransactionsTableComponent,
  ],
  templateUrl: './buchungen.component.html',
})
export class BuchungenPageComponent implements OnInit {
  protected store = inject(TransactionsStore);
  protected householdStore = inject(HouseholdStore);
  private dialogService = inject(KlarDialogService);
  private pageHeader = inject(PageHeaderService);

  readonly monthLabel = computed(() => this.formatMonthLabel(this.store.currentMonth()));

  readonly householdLabel = computed(() => this.householdStore.activeName());

  readonly incomeCount = computed(
    () => (this.store.items() ?? []).filter(t => !t.isPlanned && t.amountCents > 0).length,
  );

  readonly expenseRatio = computed<number | null>(() => {
    const income = this.store.totalIncomeCents();
    if (income <= 0) return null;
    return Math.round((Math.abs(this.store.totalExpenseCents()) / income) * 100);
  });

  readonly expenseRating = computed(() => {
    const r = this.expenseRatio();
    if (r === null) return '';
    if (r <= 50) return 'Sehr gut';
    if (r <= 70) return 'Gut';
    if (r <= 85) return 'OK';
    if (r <= 100) return 'Knapp';
    return 'Kritisch';
  });

  readonly surplusRatio = computed<number | null>(() => {
    const income = this.store.totalIncomeCents();
    if (income === 0) return null;
    return Math.round((this.store.nettoCents() / Math.abs(income)) * 100);
  });

  readonly surplusRating = computed(() => {
    const r = this.surplusRatio();
    if (r === null) return '';
    if (r >= 30) return 'Sehr gut';
    if (r >= 15) return 'Gut';
    if (r >= 5) return 'OK';
    if (r >= 0) return 'Knapp';
    return 'Negativ';
  });

  constructor() {
    this.pageHeader.set({
      title: 'Buchungen',
      subtitle: 'Cashflow · Buchungen',
      showAdd: true,
      showExport: false,
      showUserSwitch: true,
      scopeSegments: [
        { id: 'month', label: this.formatMonthLabel(this.store.currentMonth()) },
        { id: 'avg6m', label: 'Schnitt 6 M' },
        { id: 'year', label: 'Jahr' },
      ],
      scopeValue: 'month',
      addLabel: 'Buchung',
      onAdd: () => this.openCreate(),
    });

    effect(() => {
      const label = this.formatMonthLabel(this.store.currentMonth());
      this.pageHeader.scopeSegments.set([
        { id: 'month', label },
        { id: 'avg6m', label: 'Schnitt 6 M' },
        { id: 'year', label: 'Jahr' },
      ]);
    });
  }

  ngOnInit(): void {
    // Reset any account filter the user may have set before navigating here
    // so the cashflow lens shows the current month, not a stale account view.
    this.store.setAccountIdFilter(null);
  }

  openCreate(): void {
    this.dialogService.open({
      title: 'Buchung anlegen',
      component: TransactionDialogComponent,
      inputs: { tx: null },
      width: 'md',
    });
  }

  openEdit(tx: Transaction): void {
    this.dialogService.open({
      title: 'Buchung bearbeiten',
      component: TransactionDialogComponent,
      inputs: { tx },
      width: 'md',
    });
  }

  private formatMonthLabel(yearMonth: string): string {
    const [y, m] = yearMonth.split('-').map(Number);
    if (!y || !m) return yearMonth;
    const date = new Date(Date.UTC(y, m - 1, 1));
    return new Intl.DateTimeFormat('de-DE', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(date);
  }
}
