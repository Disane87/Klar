import { Component, computed, effect, inject } from '@angular/core';
import { NgClass } from '@angular/common';
import { Router } from '@angular/router';
import { KlarMoneyPipe } from '../../shared/pipes/klar-money.pipe';
import { KlarMoneyClassPipe } from '../../shared/pipes/klar-money-class.pipe';
import { KlarAsyncStateComponent, KlarLoadingTplDirective } from '../../shared/ui/klar-async-state.component';
import { KlarSkeletonComponent } from '../../shared/ui/klar-skeleton.component';
import { OverviewStore } from '../../core/overview/overview.store';
import { TransactionsStore } from '../../core/transactions/transactions.store';
import { PageHeaderService } from '../../core/page-header/page-header.service';

@Component({
  selector: 'app-monat',
  standalone: true,
  host: { class: 'flex flex-col flex-1 min-h-0 overflow-hidden' },
  imports: [
    NgClass,
    KlarMoneyPipe,
    KlarMoneyClassPipe,
    KlarAsyncStateComponent,
    KlarLoadingTplDirective,
    KlarSkeletonComponent,
  ],
  templateUrl: './monat.component.html',
  styleUrl: './monat.component.css',
})
export class MonatPageComponent {
  protected store  = inject(OverviewStore);
  private txStore  = inject(TransactionsStore);
  private pageHeader = inject(PageHeaderService);
  private router    = inject(Router);

  constructor() {
    this.pageHeader.set({
      title:         'Cashflow',
      subtitle:      'Cashflow · Monatsansicht',
      showPlanspiel: true,
      showAdd:       true,
      showUserSwitch: true,
      addLabel:      'Buchung',
      onPlanspiel:   () => this.router.navigate(['/app/planspiel']),
      onAdd:         () => this.router.navigate(['/app/buchungen']),
    });

    effect(() => { this.txStore.setMonth(this.store.currentMonth()); });

    effect(() => {
      const cf = this.store.cashflow();
      if (!cf) return;
      this.pageHeader.stats.set([{
        label:      'Überschuss',
        valueCents: cf.surplusCents,
        tone:       cf.surplusCents >= 0 ? 'surplus' : 'expense',
      }]);
    });
  }

  protected openCreate(): void {
    this.router.navigate(['/app/buchungen']);
  }

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
      return `Stand ${dd}.${mm}. — ${hh}:${min}`;
    }
    return new Date(Number(year), Number(month) - 1, 1)
      .toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
  });

  protected readonly isCurrentMonth = computed(() => {
    const [year, month] = this.store.currentMonth().split('-');
    const now = new Date();
    return now.getFullYear() === Number(year) && now.getMonth() + 1 === Number(month);
  });
}
