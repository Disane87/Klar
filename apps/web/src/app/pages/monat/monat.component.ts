import { Component, computed, effect, inject } from '@angular/core';
import { NgClass } from '@angular/common';
import { Router } from '@angular/router';
import { KlarMoneyPipe } from '../../shared/pipes/klar-money.pipe';
import { KlarMoneyClassPipe } from '../../shared/pipes/klar-money-class.pipe';
import { KlarAsyncStateComponent, KlarLoadingTplDirective } from '../../shared/ui/klar-async-state.component';
import { KlarSkeletonComponent } from '../../shared/ui/klar-skeleton.component';
import { KlarIconComponent } from '../../shared/icons/klar-icon.component';
import { OverviewStore } from '../../core/overview/overview.store';
import { BudgetVsActualsStore } from '../../core/overview/budgets-vs-actuals.store';
import { CategoriesStore } from '../../core/categories/categories.store';
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
    KlarIconComponent,
  ],
  templateUrl: './monat.component.html',
  styleUrl: './monat.component.css',
})
export class MonatPageComponent {
  protected store         = inject(OverviewStore);
  protected budgetStore   = inject(BudgetVsActualsStore);
  private categoriesStore = inject(CategoriesStore);
  private txStore         = inject(TransactionsStore);
  private pageHeader      = inject(PageHeaderService);
  private router          = inject(Router);

  // Expose Math to the template for clamping the meter width.
  protected readonly Math = Math;

  constructor() {
    this.pageHeader.set({
      title:         this.monthLabel(),
      subtitle:      'Cashflow · Monatsansicht',
      showAdd:       true,
      showUserSwitch: true,
      addLabel:      'Buchung',
      onAdd:         () => this.router.navigate(['/app/buchungen']),
    });

    effect(() => { this.txStore.setMonth(this.store.currentMonth()); });
    effect(() => { this.budgetStore.setMonth(this.store.currentMonth()); });

    // Keep header title in sync with the active month.
    effect(() => { this.pageHeader.title.set(this.monthLabel()); });

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

  private monthLabel(): string {
    const [year, month] = this.store.currentMonth().split('-');
    return new Date(Number(year), Number(month) - 1, 1)
      .toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
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

  protected categoryName(id: string): string {
    return this.categoriesStore.byId(id)?.name ?? '—';
  }

  protected categoryColor(id: string): string {
    return this.categoriesStore.byId(id)?.color ?? 'var(--fg-3)';
  }

  protected readonly isCurrentMonth = computed(() => {
    const [year, month] = this.store.currentMonth().split('-');
    const now = new Date();
    return now.getFullYear() === Number(year) && now.getMonth() + 1 === Number(month);
  });

  /** Hero eyebrow built from the surplus state plus an optional date stamp. */
  protected readonly heroEyebrow = computed(() => {
    const base = this.surplusPositive() ? 'Überschuss' : 'Defizit';
    return this.isCurrentMonth() ? `${base} · ${this.statusDate()}` : base;
  });

  // ── Liquidity-Forecast (zentrale Antwort: komme ich bis Monatsende hin?) ──

  protected readonly liquidity = computed(() => this.store.liquidity());

  /** Pretty-formatted last-day-of-current-month for the Hero headline. */
  protected readonly eomLabel = computed(() => {
    const now = new Date();
    const eom = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return eom.toLocaleDateString('de-DE', { day: 'numeric', month: 'long' });
  });

  // ── Diagnose-Sektion (sekundär) ──────────────────────────────────────────

  protected readonly projection = computed(() => this.store.cashflow()?.projectedSurplusCents ?? null);
  protected readonly insights   = computed(() => this.store.cashflow()?.insights ?? []);
  protected readonly topExpenses = computed(() => this.store.cashflow()?.topExpenses ?? []);
  protected readonly topIncome   = computed(() => this.store.cashflow()?.topIncome ?? []);
  protected readonly prevDelta   = computed(() => this.store.cashflow()?.surplusDeltaPrevMonthCents ?? null);

  protected readonly pacingPercent = computed(() => {
    const cf = this.store.cashflow();
    if (!cf || cf.daysInMonth === 0) return 0;
    return Math.round((cf.dayOfMonth / cf.daysInMonth) * 100);
  });

  /** Quick lookup: which icon to show next to an insight card by kind. */
  protected insightIcon(kind: string): string {
    switch (kind) {
      case 'transfer-excluded':       return 'arrow-left-right';
      case 'folgelastschrift-spike':  return 'alert-triangle';
      case 'pace-warn':               return 'trending-down';
      case 'pace-ok':                 return 'trending-up';
      default:                        return 'info';
    }
  }

  /** Tone (Tailwind variable) for the insight card border + icon. */
  protected insightTone(kind: string): 'info' | 'warn' | 'success' {
    switch (kind) {
      case 'pace-warn':
      case 'folgelastschrift-spike': return 'warn';
      case 'pace-ok':                return 'success';
      default:                       return 'info';
    }
  }

  protected formatTxDate(iso: string): string {
    const [, m, d] = iso.split('-');
    return `${parseInt(d, 10)}.${parseInt(m, 10)}.`;
  }

  protected truncate(s: string | null, max = 60): string {
    if (!s) return '—';
    return s.length > max ? s.slice(0, max - 1) + '…' : s;
  }
}
