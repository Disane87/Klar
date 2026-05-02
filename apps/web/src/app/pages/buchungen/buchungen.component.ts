import { Component, inject } from '@angular/core';
import { NgClass } from '@angular/common';
import { KlarSkeletonComponent } from '../../shared/ui/klar-skeleton.component';
import { BrandIconComponent } from '../../shared/ui/brand-icon.component';
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

@Component({
  selector: 'app-buchungen',
  standalone: true,
  host: { class: 'flex flex-col flex-1 min-h-0 overflow-hidden' },
  imports: [NgClass, KlarSkeletonComponent, BrandIconComponent, KlarMoneyPipe, KlarMoneyClassPipe, KlarErrorBarComponent, KlarEmptyStateComponent, KlarMonthPickerComponent, KlarSkeletonRowsComponent],
  templateUrl: './buchungen.component.html',
  styleUrl: './buchungen.component.css',
})
export class BuchungenPageComponent {
  protected store       = inject(TransactionsStore);
  private dialogService = inject(KlarDialogService);

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

  openCreate(): void {
    this.dialogService.open({
      title:     'Buchung anlegen',
      component: TransactionDialogComponent,
      inputs:    { tx: null },
      width:     'sm',
    });
  }

  openEdit(tx: Transaction, event: Event): void {
    event.stopPropagation();
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
}
