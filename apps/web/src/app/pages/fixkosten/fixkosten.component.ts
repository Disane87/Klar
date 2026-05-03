import { Component, computed, effect, inject, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { Router } from '@angular/router';
import { KlarSkeletonComponent } from '../../shared/ui/klar-skeleton.component';
import { KlarIconComponent } from '../../shared/icons/klar-icon.component';
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
  imports: [NgClass, KlarSkeletonComponent, KlarIconComponent, KlarMoneyPipe, KlarMoneyClassPipe, KlarErrorBarComponent, KlarEmptyStateComponent],
  templateUrl: './fixkosten.component.html',
  styleUrl: './fixkosten.component.css',
})
export class FixkostenPageComponent {
  protected store       = inject(OverviewStore);
  private pageHeader    = inject(PageHeaderService);
  private dialogService = inject(KlarDialogService);

  constructor() {
    const router = inject(Router);
    this.pageHeader.set({
      title:         'Fixkosten',
      showPlanspiel: true,
      showAdd:       true,
      addLabel:      'Buchung',
      onPlanspiel:   () => router.navigate(['/app/planspiel']),
      onAdd:         () => router.navigate(['/app/buchungen']),
    });

    effect(() => {
      const surplus = this.surplusCents();
      this.pageHeader.stats.set([{
        label:      'Überschuss',
        valueCents: surplus,
        tone:       surplus >= 0 ? 'surplus' : 'expense',
      }]);
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
    event.stopPropagation();
    this.dialogService.open({
      title:     'Eintrag bearbeiten',
      component: RecurringEditDialogComponent,
      inputs:    { item },
      width:     'sm',
    });
  }

  // ── Enriched groups ──────────────────────────────────────────────────────────

  readonly enrichedGroups = computed(() => this.store.fixedCosts()?.groups ?? []);

  // ── Summary computed ─────────────────────────────────────────────────────────

  readonly incomeTotalCents = computed(() =>
    this.enrichedGroups().filter(g => g.totalCents > 0).reduce((s, g) => s + g.totalCents, 0)
  );

  readonly expenseTotalCents = computed(() =>
    this.enrichedGroups().filter(g => g.totalCents < 0).reduce((s, g) => s + g.totalCents, 0)
  );

  readonly surplusCents = computed(() => this.incomeTotalCents() + this.expenseTotalCents());

  // ── Formatting helpers ───────────────────────────────────────────────────────

  formatDay(day: number | null): string {
    if (!day) return '';
    return String(day).padStart(2, '0') + '.';
  }

  shortFreq(freq: RecurringFrequency): string {
    switch (freq) {
      case 'QUARTERLY':   return '/ Quartal';
      case 'YEARLY':      return '/ Jahr';
      case 'CUSTOM_DAYS': return '/ individuell';
      default:            return '';
    }
  }
}
