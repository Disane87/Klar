import { Component, computed, effect, inject, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { Router } from '@angular/router';
import { KlarMoneyPipe } from '../../shared/pipes/klar-money.pipe';
import { KlarMoneyClassPipe } from '../../shared/pipes/klar-money-class.pipe';
import { KlarErrorBarComponent } from '../../shared/ui/klar-error-bar.component';
import { KlarEmptyStateComponent } from '../../shared/ui/klar-empty-state.component';
import { KlarStatCardComponent } from '../../shared/ui/klar-stat-card.component';
import { KlarSkeletonCardsComponent } from '../../shared/ui/klar-skeleton-cards.component';
import { HlmCalendarComponent, type CalendarEvent, type CalendarEventMap } from '../../shared/ui/hlm/hlm-calendar.component';
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
    KlarErrorBarComponent,
    KlarEmptyStateComponent,
    KlarStatCardComponent,
    KlarSkeletonCardsComponent,
    HlmCalendarComponent,
  ],
  templateUrl: './monat.component.html',
  styleUrl: './monat.component.css',
})
export class MonatPageComponent {
  protected store  = inject(OverviewStore);
  private txStore  = inject(TransactionsStore);

  protected readonly sheetDay = signal<{ date: Date; events: CalendarEvent[] } | null>(null);

  protected readonly sheetDayLabel = computed(() => {
    const sd = this.sheetDay();
    if (!sd) return '';
    return new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'long' }).format(sd.date);
  });

  protected readonly sumAmounts = (acc: number, ev: CalendarEvent) => acc + ev.amountCents;

  constructor() {
    const router = inject(Router);
    inject(PageHeaderService).set({
      title:         'Monatsansicht',
      subtitle:      'WAS DIESER MONAT GEKOSTET HAT',
      showPlanspiel: true,
      showAdd:       true,
      addLabel:      'Buchung',
      onPlanspiel:   () => router.navigate(['/app/planspiel']),
      onAdd:         () => router.navigate(['/app/buchungen']),
    });

    // Keep transaction store in sync with the overview month
    effect(() => { this.txStore.setMonth(this.store.currentMonth()); });
  }

  protected navigateMonth(month: string): void {
    this.store.setMonth(month);
  }

  protected onDayTap(payload: { date: Date; events: CalendarEvent[] }): void {
    if (window.innerWidth < 768) {
      this.sheetDay.set(payload);
    }
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

  /** Events keyed by day-of-month for the calendar scheduler */
  protected readonly calendarEvents = computed<CalendarEventMap>(() => {
    const fc = this.store.fixedCosts();
    const transactions = this.txStore.items() ?? [];
    const [yearStr, monthStr] = this.store.currentMonth().split('-');
    const year  = Number(yearStr);
    const month = Number(monthStr);
    const maxDay = new Date(year, month, 0).getDate();

    const map: CalendarEventMap = {};

    const push = (day: number, event: CalendarEventMap[number][number]) => {
      (map[day] ??= []).push(event);
    };

    // Fixed costs: use dayOfMonth (clamped to month length)
    if (fc) {
      for (const group of fc.groups) {
        for (const item of group.items) {
          if (item.dayOfMonth !== null) {
            const day = Math.min(item.dayOfMonth, maxDay);
            push(day, {
              name:        item.name,
              amountCents: item.monthlyEquivalentCents,
              color:       group.categoryColor,
              isRecurring: true,
            });
          }
        }
      }
    }

    // Transactions: parse date → day
    for (const tx of transactions) {
      const day = new Date(tx.date).getDate();
      push(day, {
        name:        tx.description || 'Buchung',
        amountCents: tx.amountCents,
        color:       tx.amountCents >= 0 ? 'var(--color-income)' : 'var(--color-expense)',
        isRecurring: false,
      });
    }

    // Sort each day's events: recurring first, then by amount desc
    for (const day of Object.keys(map)) {
      map[Number(day)].sort((a, b) => {
        if (a.isRecurring !== b.isRecurring) return a.isRecurring ? -1 : 1;
        return Math.abs(b.amountCents) - Math.abs(a.amountCents);
      });
    }

    return map;
  });
}
