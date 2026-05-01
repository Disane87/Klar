import { Component, computed, inject } from '@angular/core';
import { KlarSkeletonComponent } from '../../shared/ui/klar-skeleton.component';
import { KlarIconComponent } from '../../shared/icons/klar-icon.component';
import { OverviewStore } from '../../core/overview/overview.store';
import { PageHeaderService } from '../../core/page-header/page-header.service';

@Component({
  selector: 'app-monat',
  standalone: true,
  imports: [KlarSkeletonComponent, KlarIconComponent],
  templateUrl: './monat.component.html',
  styleUrl: './monat.component.css',
})
export class MonatPageComponent {
  protected store = inject(OverviewStore);

  constructor() {
    inject(PageHeaderService).set({
      title:         'Monatsansicht',
      subtitle:      'WAS DIESER MONAT GEKOSTET HAT',
      showPlanspiel: true,
      showAdd:       true,
      addLabel:      'Buchung',
    });
  }

  protected readonly displayMonth = computed(() => {
    const [year, month] = this.store.currentMonth().split('-');
    const date = new Date(Number(year), Number(month) - 1, 1);
    return date.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
  });

  protected readonly surplusPositive = computed(() => {
    const cf = this.store.cashflow();
    return cf ? cf.surplusCents >= 0 : false;
  });

  protected readonly statusDate = computed(() => {
    const [year, month] = this.store.currentMonth().split('-');
    const now = new Date();
    if (now.getFullYear() === Number(year) && now.getMonth() + 1 === Number(month)) {
      const dd = String(now.getDate()).padStart(2, '0');
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const hh = String(now.getHours()).padStart(2, '0');
      const min = String(now.getMinutes()).padStart(2, '0');
      return `STAND ${dd}.${mm}. — ${hh}:${min}`;
    }
    return new Date(Number(year), Number(month) - 1, 1)
      .toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })
      .toUpperCase();
  });

  protected readonly isCurrentMonth = computed(() => {
    const [year, month] = this.store.currentMonth().split('-');
    const now = new Date();
    return now.getFullYear() === Number(year) && now.getMonth() + 1 === Number(month);
  });

  formatCents(cents: number): string {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(cents / 100);
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
