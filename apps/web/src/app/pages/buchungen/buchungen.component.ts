import { Component, computed, inject } from '@angular/core';
import { KlarSkeletonComponent } from '../../shared/ui/klar-skeleton.component';
import { KlarIconComponent } from '../../shared/icons/klar-icon.component';
import { TransactionsStore } from '../../core/transactions/transactions.store';
import { PageHeaderService } from '../../core/page-header/page-header.service';

@Component({
  selector: 'app-buchungen',
  standalone: true,
  imports: [KlarSkeletonComponent, KlarIconComponent],
  templateUrl: './buchungen.component.html',
  styleUrl: './buchungen.component.css',
})
export class BuchungenPageComponent {
  protected store = inject(TransactionsStore);

  constructor() {
    inject(PageHeaderService).set({
      title: 'Buchungen',
      subtitle: 'MONATLICHE AUSGABEN & EINNAHMEN',
      showPlanspiel: false,
      showAdd: true,
      addLabel: 'Buchung',
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
    // YYYY-MM-DD → DD.MM.
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
