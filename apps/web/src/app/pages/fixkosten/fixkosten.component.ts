import { Component, computed, inject, signal } from '@angular/core';
import { LowerCasePipe, NgClass } from '@angular/common';
import { Router } from '@angular/router';
import { KlarSkeletonComponent } from '../../shared/ui/klar-skeleton.component';
import { KlarIconComponent } from '../../shared/icons/klar-icon.component';
import { BrandIconComponent } from '../../shared/ui/brand-icon.component';
import { KlarDialogService } from '../../shared/ui/klar-dialog.service';
import { OverviewStore } from '../../core/overview/overview.store';
import { PageHeaderService } from '../../core/page-header/page-header.service';
import { RecurringEditDialogComponent } from './recurring-edit-dialog.component';
import { KlarMoneyPipe } from '../../shared/pipes/klar-money.pipe';
import { KlarMoneyClassPipe } from '../../shared/pipes/klar-money-class.pipe';
import { KlarErrorBarComponent } from '../../shared/ui/klar-error-bar.component';
import { KlarEmptyStateComponent } from '../../shared/ui/klar-empty-state.component';
import type { FixedCostItem } from '../../core/overview/overview.service';
import type { RecurringFrequency } from '@klar/shared';

@Component({
  selector: 'app-fixkosten',
  standalone: true,
  host: { class: 'flex flex-col flex-1 min-h-0 overflow-hidden' },
  imports: [LowerCasePipe, NgClass, KlarSkeletonComponent, KlarIconComponent, BrandIconComponent, KlarMoneyPipe, KlarMoneyClassPipe, KlarErrorBarComponent, KlarEmptyStateComponent],
  templateUrl: './fixkosten.component.html',
  styleUrl: './fixkosten.component.css',
})
export class FixkostenPageComponent {
  protected store         = inject(OverviewStore);
  private dialogService   = inject(KlarDialogService);

  constructor() {
    const router = inject(Router);
    inject(PageHeaderService).set({
      title:          'Fixkosten',
      subtitle:       'WIEDERKEHRENDE EIN- UND AUSGABEN',
      showPlanspiel:  true,
      showAdd:        true,
      addLabel:       'Buchung',
      onPlanspiel:    () => router.navigate(['/app/planspiel']),
      onAdd:          () => router.navigate(['/app/buchungen']),
    });
  }

  // ── Collapse state ───────────────────────────────────────────────────────────

  readonly collapsedGroups = signal(new Set<string>());

  toggleGroup(categoryId: string): void {
    this.collapsedGroups.update(set => {
      const next = new Set(set);
      next.has(categoryId) ? next.delete(categoryId) : next.add(categoryId);
      return next;
    });
  }

  isCollapsed(categoryId: string): boolean {
    return this.collapsedGroups().has(categoryId);
  }

  // ── Edit via dialog ──────────────────────────────────────────────────────────

  openEdit(item: FixedCostItem, event: Event): void {
    event.stopPropagation(); // don't toggle group collapse
    this.dialogService.open({
      title:     'Eintrag bearbeiten',
      component: RecurringEditDialogComponent,
      inputs:    { item },
      width:     'sm',
    });
  }

  // ── Enriched groups ──────────────────────────────────────────────────────────

  // Backend liefert bereits korrekte Reihenfolge: INCOME → FIXED_INCOME → EXPENSE
  readonly enrichedGroups = computed(() => this.store.fixedCosts()?.groups ?? []);

  // ── Summary computed ─────────────────────────────────────────────────────────

  readonly incomeTotalCents = computed(() =>
    this.enrichedGroups().filter(g => g.totalCents > 0).reduce((s, g) => s + g.totalCents, 0)
  );

  readonly expenseTotalCents = computed(() =>
    this.enrichedGroups().filter(g => g.totalCents < 0).reduce((s, g) => s + g.totalCents, 0)
  );

  readonly incomeSourceCount = computed(() =>
    this.enrichedGroups().filter(g => g.totalCents > 0).reduce((s, g) => s + g.items.length, 0)
  );

  readonly expenseCategoryCount = computed(() =>
    this.enrichedGroups().filter(g => g.totalCents < 0).length
  );

  readonly surplusCents = computed(() => this.incomeTotalCents() + this.expenseTotalCents());

  readonly surplusPercent = computed(() => {
    const inc = this.incomeTotalCents();
    if (inc === 0) return 0;
    return Math.round((this.surplusCents() / inc) * 1000) / 10;
  });

  readonly monthDisplay = computed(() => {
    const [year, month] = this.store.currentMonth().split('-');
    const date = new Date(Number(year), Number(month) - 1, 1);
    return date.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' }).toUpperCase();
  });

  // ── Formatting helpers ───────────────────────────────────────────────────────

  formatDay(day: number | null): string {
    if (!day) return '';
    return String(day).padStart(2, '0') + '.';
  }

  frequencyLabel(freq: RecurringFrequency): string {
    switch (freq) {
      case 'MONTHLY':     return 'Monatlich';
      case 'QUARTERLY':   return 'Quartalsweise';
      case 'YEARLY':      return 'Jährlich';
      case 'CUSTOM_DAYS': return 'Individuell';
    }
  }
}
