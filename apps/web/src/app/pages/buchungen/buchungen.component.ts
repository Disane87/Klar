import { Component, computed, inject } from '@angular/core';
import { KlarSkeletonComponent } from '../../shared/ui/klar-skeleton.component';
import { KlarIconComponent } from '../../shared/icons/klar-icon.component';
import { BrandIconComponent } from '../../shared/ui/brand-icon.component';
import { KlarDialogService } from '../../shared/ui/klar-dialog.service';
import { TransactionsStore, Transaction } from '../../core/transactions/transactions.store';
import { PageHeaderService } from '../../core/page-header/page-header.service';
import { TransactionDialogComponent } from './transaction-dialog.component';

@Component({
  selector: 'app-buchungen',
  standalone: true,
  imports: [KlarSkeletonComponent, KlarIconComponent, BrandIconComponent],
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

  protected readonly displayMonth = computed(() => {
    const [year, month] = this.store.currentMonth().split('-');
    const date = new Date(Number(year), Number(month) - 1, 1);
    return date.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
  });

  formatCents(cents: number): string {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(cents / 100);
  }

  formatDate(dateStr: string): string {
    const parts = dateStr.split('-');
    if (parts.length < 3) return dateStr;
    return `${parts[2]}.${parts[1]}.`;
  }

  prevMonth(): void {
    const [year, month] = this.store.currentMonth().split('-').map(Number);
    const d = new Date(year, month - 2, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    this.store.setMonth(`${y}-${m}`);
  }

  nextMonth(): void {
    const [year, month] = this.store.currentMonth().split('-').map(Number);
    const d = new Date(year, month, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    this.store.setMonth(`${y}-${m}`);
  }
}
