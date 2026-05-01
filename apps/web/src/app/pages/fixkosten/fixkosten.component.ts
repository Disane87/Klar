import { Component, computed, inject, effect } from '@angular/core';
import { LowerCasePipe } from '@angular/common';
import { Router } from '@angular/router';
import { KlarSkeletonComponent } from '../../shared/ui/klar-skeleton.component';
import { KlarIconComponent } from '../../shared/icons/klar-icon.component';
import { OverviewStore } from '../../core/overview/overview.store';
import { PageHeaderService } from '../../core/page-header/page-header.service';
import type { RecurringFrequency } from '@klar/shared';

@Component({
  selector: 'app-fixkosten',
  standalone: true,
  imports: [LowerCasePipe, KlarSkeletonComponent, KlarIconComponent],
  templateUrl: './fixkosten.component.html',
  styleUrl: './fixkosten.component.css',
})
export class FixkostenPageComponent {
  protected store = inject(OverviewStore);

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

  readonly incomeTotalCents = computed(() =>
    (this.store.fixedCosts()?.groups ?? [])
      .filter(g => g.totalCents > 0)
      .reduce((s, g) => s + g.totalCents, 0)
  );

  readonly expenseTotalCents = computed(() =>
    (this.store.fixedCosts()?.groups ?? [])
      .filter(g => g.totalCents < 0)
      .reduce((s, g) => s + g.totalCents, 0)
  );

  /** Sortiert: Einnahmen-Gruppen zuerst, dann Ausgaben (wie PDF) */
  readonly sortedGroups = computed(() => {
    const groups = this.store.fixedCosts()?.groups ?? [];
    return [
      ...groups.filter(g => g.totalCents > 0),
      ...groups.filter(g => g.totalCents < 0),
    ];
  });

  readonly incomeSourceCount = computed(() =>
    (this.store.fixedCosts()?.groups ?? [])
      .filter(g => g.totalCents > 0)
      .reduce((s, g) => s + g.items.length, 0)
  );

  readonly expenseCategoryCount = computed(() =>
    (this.store.fixedCosts()?.groups ?? [])
      .filter(g => g.totalCents < 0).length
  );

  readonly surplusCents = computed(() =>
    this.incomeTotalCents() + this.expenseTotalCents()
  );

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

  formatCents(cents: number): string {
    return new Intl.NumberFormat('de-DE', {
      style:    'currency',
      currency: 'EUR',
    }).format(cents / 100);
  }

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
