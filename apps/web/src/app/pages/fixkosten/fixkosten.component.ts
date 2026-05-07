import { Component, computed, effect, inject, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { Router } from '@angular/router';
import { KlarSkeletonComponent } from '../../shared/ui/klar-skeleton.component';
import { KlarIconComponent } from '../../shared/icons/klar-icon.component';
import { KlarDialogService } from '../../shared/ui/klar-dialog.service';
import { KlarConfirmService } from '../../shared/ui/klar-confirm.service';
import { KlarToastService } from '../../shared/ui/klar-toast.service';
import { OverviewStore } from '../../core/overview/overview.store';
import { PageHeaderService } from '../../core/page-header/page-header.service';
import { PdfReportService } from '../../core/pdf/pdf-report.service';
import { HouseholdStore } from '../../core/household/household.store';
import { PlanspielStore } from '../../core/planspiel/planspiel.store';
import { RecurringEditDialogComponent } from './recurring-edit-dialog.component';
import { RecurringTransactionsService } from '../../core/recurring-transactions/recurring-transactions.service';
import { KlarMoneyPipe } from '../../shared/pipes/klar-money.pipe';
import { KlarMoneyClassPipe } from '../../shared/pipes/klar-money-class.pipe';
import { KlarErrorBarComponent } from '../../shared/ui/klar-error-bar.component';
import { KlarEmptyStateComponent } from '../../shared/ui/klar-empty-state.component';
import { BrandIconComponent } from '../../shared/ui/brand-icon.component';
import { KlarListComponent, KlarListGroupComponent, KlarListRowComponent } from '../../shared/ui/klar-list.component';
import { KlarSummaryStripComponent } from '../../shared/ui/klar-summary-strip.component';
import { KlarToolbarComponent } from '../../shared/ui/klar-toolbar.component';
import { KlarAvatarComponent } from '../../shared/ui/klar-avatar.component';
import { KlarFabComponent } from '../../shared/ui/klar-fab.component';
import { HlmCheckboxComponent } from '../../shared/ui/hlm/hlm-checkbox.component';
import { HlmButtonDirective } from '../../shared/ui/hlm/hlm-button.directive';
import { HlmSwitchComponent } from '../../shared/ui/hlm/hlm-switch.component';
import { RecurringCreateDialogComponent } from './recurring-create-dialog.component';
import type { FixedCostItem } from '../../core/overview/overview.service';
import type { RecurringFrequency } from '@klar/shared';

@Component({
  selector: 'app-fixkosten',
  standalone: true,
  host: { class: 'flex flex-col flex-1 min-h-0 overflow-hidden' },
  imports: [NgClass, KlarSkeletonComponent, KlarIconComponent, KlarMoneyPipe, KlarMoneyClassPipe, KlarErrorBarComponent, KlarEmptyStateComponent, BrandIconComponent, KlarListComponent, KlarListGroupComponent, KlarListRowComponent, KlarSummaryStripComponent, KlarToolbarComponent, KlarAvatarComponent, KlarFabComponent, HlmCheckboxComponent, HlmButtonDirective, HlmSwitchComponent],
  templateUrl: './fixkosten.component.html',
  styleUrl: './fixkosten.component.css',
})
export class FixkostenPageComponent {
  protected store         = inject(OverviewStore);
  private pageHeader      = inject(PageHeaderService);
  private dialogService   = inject(KlarDialogService);
  private confirm          = inject(KlarConfirmService);
  private router          = inject(Router);
  private pdfReport       = inject(PdfReportService);
  protected householdStore = inject(HouseholdStore);
  protected planspielStore = inject(PlanspielStore);
  private toast            = inject(KlarToastService);
  private recurring        = inject(RecurringTransactionsService);

  readonly memberFilter = signal<string | null>(null);
  readonly planspielActive = signal(false);

  readonly members = computed(() => this.householdStore.members());

  readonly memberOptions = computed(() => {
    const ms = this.members();
    return ms.map(m => ({ userId: m.userId, displayName: m.displayName, avatarUrl: m.avatarUrl ?? null }));
  });

  getHoverCardClasses(): string {
    const viewportHeight = window.innerHeight;
    const scrollY = window.scrollY;
    const headerHeight = 48;
    const availableTop = scrollY;
    const availableBottom = viewportHeight - scrollY - headerHeight;
    const cardHeight = 60;

    if (availableTop > cardHeight && availableTop >= availableBottom) {
      return 'bottom-full left-1/2 -translate-x-1/2 mb-2';
    } else {
      return 'top-full left-1/2 -translate-x-1/2 mt-2';
    }
  }

  constructor() {
    this.pageHeader.set({
      title:         'Fixkosten',
      showPlanspiel: false,
      showAdd:       true,
      showExport:    false,
      addLabel:      'Fixkosten',
      onAdd:         () => this.openCreate(),
    });

    this.householdStore.loadMembers();

    effect(() => {
      const surplus = this.surplusCents();
      this.pageHeader.stats.set([{
        label:      'Überschuss',
        valueCents: surplus,
        tone:       surplus >= 0 ? 'surplus' : 'expense',
      }]);
    });
  }

  togglePlanspiel(): void {
    const activating = !this.planspielActive();
    this.planspielActive.set(activating);
    if (activating) {
      const data = this.store.fixedCosts();
      if (data) {
        const allItems = data.groups.flatMap(g =>
          g.items.map(item => ({
            name: item.name,
            amountCents: item.amountCents,
            monthlyEquivalentCents: item.monthlyEquivalentCents,
            frequency: item.frequency as RecurringFrequency,
            categoryId: g.categoryId,
            categoryName: g.categoryName,
            categoryColor: g.categoryColor,
            categoryType: g.categoryType,
            categorySortOrder: g.categorySortOrder ?? 0,
          }))
        );
        this.planspielStore.loadFromFixkosten(allItems);
      }
    } else {
      this.planspielStore.reset();
    }
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

  // ── Create new ───────────────────────────────────────────────────────────────

  openCreate(): void {
    this.dialogService.open({
      title:     'Fixkosten erstellen',
      component: RecurringCreateDialogComponent,
      width:     'sm',
    });
  }

  // ── Bulk Selection ───────────────────────────────────────────────────────────

  readonly selectionMode = signal(false);
  readonly selectedIds   = signal(new Set<string>());
  readonly bulkDeleting  = signal(false);

  readonly selectedCount = computed(() => this.selectedIds().size);

  enterSelection(): void {
    this.selectionMode.set(true);
  }

  exitSelection(): void {
    this.selectionMode.set(false);
    this.selectedIds.set(new Set());
  }

  toggleSelectionMode(): void {
    if (this.selectionMode()) this.exitSelection();
    else this.enterSelection();
  }

  isSelected(id: string): boolean {
    return this.selectedIds().has(id);
  }

  toggleItem(id: string): void {
    this.selectedIds.update(set => {
      const next = new Set(set);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  groupSelectionState(group: { items: { id: string }[] }): 'none' | 'partial' | 'all' {
    const ids = group.items.map(i => i.id);
    if (ids.length === 0) return 'none';
    const sel = this.selectedIds();
    let count = 0;
    for (const id of ids) if (sel.has(id)) count++;
    if (count === 0) return 'none';
    if (count === ids.length) return 'all';
    return 'partial';
  }

  toggleGroupSelection(group: { items: { id: string }[] }): void {
    const state = this.groupSelectionState(group);
    this.selectedIds.update(set => {
      const next = new Set(set);
      if (state === 'all') {
        for (const it of group.items) next.delete(it.id);
      } else {
        for (const it of group.items) next.add(it.id);
      }
      return next;
    });
  }

  async bulkDelete(): Promise<void> {
    const ids = [...this.selectedIds()];
    if (ids.length === 0 || this.bulkDeleting()) return;

    const hid = this.householdStore.activeId();
    if (!hid) return;

    const confirmed = await this.confirm.ask({
      title: ids.length === 1 ? 'Eintrag löschen?' : 'Einträge löschen?',
      message: `${ids.length} ${ids.length === 1 ? 'Eintrag' : 'Einträge'} wirklich löschen?`,
      confirmLabel: 'Löschen',
      tone: 'danger',
    });
    if (!confirmed) return;

    this.bulkDeleting.set(true);
    try {
      const results = await Promise.allSettled(
        ids.map(id => this.recurring.delete(hid, id))
      );
      const failed = results.filter(r => r.status === 'rejected').length;
      this.store.reload();
      this.exitSelection();
      if (failed === 0) {
        this.toast.success(`${ids.length} ${ids.length === 1 ? 'Eintrag gelöscht' : 'Einträge gelöscht'}`);
      } else {
        this.toast.error(`${failed} von ${ids.length} konnten nicht gelöscht werden`);
      }
    } finally {
      this.bulkDeleting.set(false);
    }
  }

  // ── Edit via dialog ──────────────────────────────────────────────────────────

  openEdit(item: FixedCostItem): void {
    if (this.selectionMode()) {
      this.toggleItem(item.id);
      return;
    }
    if (this.planspielActive()) {
      this.dialogService.open({
        title:     'Eintrag bearbeiten (Planspiel)',
        component: RecurringEditDialogComponent,
        inputs:    { item, planspielMode: true },
        width:     'sm',
      });
    } else {
      this.dialogService.open({
        title:     'Eintrag bearbeiten',
        component: RecurringEditDialogComponent,
        inputs:    { item, planspielMode: false },
        width:     'sm',
      });
    }
  }

  formatItemSublabel(item: FixedCostItem): string {
    const parts: string[] = [this.freqLabel(item.frequency)];
    if (item.dayOfMonth) {
      if (item.frequency === 'WEEKLY') parts.push(this.weekdayName(item.dayOfMonth));
      else                             parts.push('Tag ' + item.dayOfMonth);
    }
    return parts.join(' · ');
  }

  weekdayName(d: number): string {
    return ['Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag','Sonntag'][d - 1] ?? '';
  }

  weekdayAbbr(d: number): string {
    return ['Mo','Di','Mi','Do','Fr','Sa','So'][d - 1] ?? '';
  }

  isWeeklyFreq(item: FixedCostItem): boolean {
    return item.frequency === 'WEEKLY';
  }

  // ── Enriched groups (filtered by member, planspiel-aware) ─────────────────────

  readonly enrichedGroups = computed(() => {
    if (this.planspielActive()) {
      const entries = this.planspielStore.entries();
      const grouped = new Map<string, { categoryId: string; categoryName: string; categoryColor: string; categoryType: string; categorySortOrder: number; totalCents: number; items: any[] }>();
      for (const entry of entries) {
        const key = entry.categoryId ?? 'other';
        const existing = grouped.get(key);
        const item = {
          id: entry.id,
          categoryId: key,
          name: entry.label,
          amountCents: entry.amountCents,
          monthlyEquivalentCents: entry.amountCents,
          frequency: entry.frequency,
          isVariable: false,
          dayOfMonth: null,
          createdBy: null,
          createdById: null,
        };
        if (existing) {
          existing.items.push(item);
          existing.totalCents += entry.amountCents;
        } else {
grouped.set(key, {
            categoryId: key,
            categoryName: entry.categoryName ?? 'Sonstige',
            categoryColor: entry.color,
            categoryType: entry.categoryType ?? (entry.amountCents >= 0 ? 'INCOME' : 'EXPENSE'),
            categorySortOrder: entry.categorySortOrder ?? 0,
            totalCents: entry.amountCents,
            items: [item],
          });
        }
      }
      const typeOrder: Record<string, number> = {
        FIXED_INCOME: 0,
        VARIABLE_INCOME: 1,
        INCOME: 1, // legacy alias
        FIXED_EXPENSE: 2,
        VARIABLE_EXPENSE: 3,
        EXPENSE: 3, // legacy alias
        SAVINGS: 4,
      };
      return [...grouped.values()].sort((a, b) => {
        const ta = typeOrder[a.categoryType] ?? 9;
        const tb = typeOrder[b.categoryType] ?? 9;
        if (ta !== tb) return ta - tb;
        return (a.categorySortOrder ?? 0) - (b.categorySortOrder ?? 0);
      });
    }

    const groups = this.store.fixedCosts()?.groups ?? [];
    const filterUserId = this.memberFilter();

    if (!filterUserId) return groups;

    return groups
      .map(g => {
        const filtered = g.items.filter(item => item.createdById === filterUserId);
        const totalCents = filtered.reduce((s, item) => s + item.monthlyEquivalentCents, 0);
        return { ...g, items: filtered, totalCents };
      })
      .filter(g => g.items.length > 0);
  });

  // ── Summary computed ─────────────────────────────────────────────────────────

  readonly incomeTotalCents = computed(() =>
    this.enrichedGroups().filter(g => g.totalCents > 0).reduce((s, g) => s + g.totalCents, 0)
  );

  readonly expenseTotalCents = computed(() =>
    this.enrichedGroups().filter(g => g.totalCents < 0).reduce((s, g) => s + g.totalCents, 0)
  );

  readonly surplusCents = computed(() => this.incomeTotalCents() + this.expenseTotalCents());

  readonly expenseRatio = computed(() => {
    const income = this.incomeTotalCents();
    if (income <= 0) return null;
    return Math.round((Math.abs(this.expenseTotalCents()) / income) * 100);
  });

  readonly surplusRatio = computed(() => {
    const income = this.incomeTotalCents();
    if (income === 0) return null;
    return Math.round((this.surplusCents() / Math.abs(income)) * 100);
  });

  readonly expenseRating = computed(() => {
    const ratio = this.expenseRatio();
    if (ratio === null) return '';
    if (ratio <= 50) return 'Sehr gut';
    if (ratio <= 70) return 'Gut';
    if (ratio <= 85) return 'OK';
    if (ratio <= 100) return 'Knapp';
    return 'Kritisch';
  });

  readonly expenseRatingColor = computed(() => {
    const ratio = this.expenseRatio();
    if (ratio === null) return '';
    if (ratio <= 50) return 'text-(--color-income)';
    if (ratio <= 70) return 'text-(--color-income)';
    if (ratio <= 85) return 'text-(--color-surplus)';
    if (ratio <= 100) return 'text-yellow-400';
    return 'text-(--color-expense)';
  });

  readonly surplusRating = computed(() => {
    const ratio = this.surplusRatio();
    if (ratio === null) return '';
    if (ratio >= 30) return 'Sehr gut';
    if (ratio >= 15) return 'Gut';
    if (ratio >= 5) return 'OK';
    if (ratio >= 0) return 'Knapp';
    return 'Negativ';
  });

  readonly surplusRatingColor = computed(() => {
    const ratio = this.surplusRatio();
    if (ratio === null) return '';
    if (ratio >= 30) return 'text-(--color-income)';
    if (ratio >= 15) return 'text-(--color-income)';
    if (ratio >= 5) return 'text-(--color-surplus)';
    if (ratio >= 0) return 'text-yellow-400';
    return 'text-(--color-expense)';
  });

  readonly optimalSavingsCents = computed(() => {
    const income = this.incomeTotalCents();
    if (income <= 0) return 0;
    return Math.round(income * 0.2);
  });

  readonly savingsGapCents = computed(() => {
    return this.surplusCents() - this.optimalSavingsCents();
  });

  readonly savingsGapPercent = computed(() => {
    const income = this.incomeTotalCents();
    if (income <= 0) return 0;
    return Math.round((this.savingsGapCents() / Math.abs(income)) * 100);
  });

  readonly savingsRating = computed(() => {
    const ratio = this.savingsGapPercent();
    if (ratio >= 5) return 'Super';
    if (ratio >= 0) return 'Gut';
    if (ratio >= -5) return 'Knapp';
    return 'Zu wenig';
  });

  readonly savingsRatingColor = computed(() => {
    const ratio = this.savingsGapPercent();
    if (ratio >= 5) return 'text-(--color-income)';
    if (ratio >= 0) return 'text-(--color-income)';
    if (ratio >= -5) return 'text-yellow-400';
    return 'text-(--color-expense)';
  });

  readonly incomeBracket = computed(() => {
    const monthlyEur = this.incomeTotalCents() / 100;
    if (monthlyEur <= 0) return { label: '–', desc: '' };
    if (monthlyEur < 1500) return { label: 'Niedrig', desc: '< 1.500 €' };
    if (monthlyEur < 2800) return { label: 'Mittel', desc: '1.500 – 2.800 €' };
    if (monthlyEur < 5000) return { label: 'Gehoben', desc: '2.800 – 5.000 €' };
    if (monthlyEur < 8000) return { label: 'Hoch', desc: '5.000 – 8.000 €' };
    return { label: 'Sehr hoch', desc: '> 8.000 €' };
  });

  // ── Formatting helpers ───────────────────────────────────────────────────────

  formatDay(day: number | null): string {
    if (!day) return '';
    return String(day).padStart(2, '0') + '.';
  }

  shortFreq(freq: RecurringFrequency): string {
    switch (freq) {
      case 'WEEKLY':      return '/ Woche';
      case 'QUARTERLY':   return '/ Quartal';
      case 'HALF_YEARLY': return '/ Halbjahr';
      case 'YEARLY':      return '/ Jahr';
      case 'CUSTOM_DAYS': return '/ individuell';
      default:            return '';
    }
  }

  freqLabel(freq: RecurringFrequency): string {
    switch (freq) {
      case 'WEEKLY':      return 'Wöchentlich';
      case 'MONTHLY':     return 'Monatlich';
      case 'QUARTERLY':   return 'Quartalsweise';
      case 'HALF_YEARLY': return 'Halbjährlich';
      case 'YEARLY':      return 'Jährlich';
      case 'CUSTOM_DAYS': return 'Individuell';
      default:            return freq;
    }
  }

  freqIcon(freq: RecurringFrequency): string {
    switch (freq) {
      case 'WEEKLY':      return 'lucide:calendar';
      case 'MONTHLY':     return 'lucide:calendar-days';
      case 'QUARTERLY':   return 'lucide:calendar-range';
      case 'HALF_YEARLY': return 'lucide:calendar-clock';
      case 'YEARLY':      return 'lucide:calendar-check';
      case 'CUSTOM_DAYS': return 'lucide:calendar-cog';
      default:            return 'lucide:calendar';
    }
  }

  freqColor(freq: RecurringFrequency): string {
    switch (freq) {
      case 'WEEKLY':      return '#06b6d4'; // cyan
      case 'MONTHLY':     return '#22c55e'; // green
      case 'QUARTERLY':   return '#3b82f6'; // blue
      case 'HALF_YEARLY': return '#ec4899'; // pink
      case 'YEARLY':      return '#a855f7'; // purple
      case 'CUSTOM_DAYS': return '#f59e0b'; // amber
      default:            return '#6b7280'; // gray
    }
  }

  // ── PDF Export ────────────────────────────────────────────────────────────────

  async exportPdf(): Promise<void> {
    const data = this.store.fixedCosts();
    if (!data) return;

    const filterUserId = this.memberFilter();
    const scopeName = filterUserId
      ? (this.members().find(m => m.userId === filterUserId)?.displayName ?? 'Haushalt')
      : (this.householdStore.activeName() || 'Haushalt');

    const groups = filterUserId
      ? data.groups
          .map(g => {
            const items = g.items.filter(i => i.createdById === filterUserId);
            const totalCents = items.reduce((s, i) => s + i.monthlyEquivalentCents, 0);
            return { ...g, items, totalCents };
          })
          .filter(g => g.items.length > 0)
      : data.groups;

    await this.pdfReport.exportFixkosten({
      groups,
      incomeTotalCents:   this.incomeTotalCents(),
      expenseTotalCents:  this.expenseTotalCents(),
      surplusCents:       this.surplusCents(),
      householdName:      scopeName,
      month:              this.store.currentMonth(),
      expenseRatio:       this.expenseRatio(),
      surplusRatio:       this.surplusRatio(),
      expenseRating:      this.expenseRating(),
      surplusRating:      this.surplusRating(),
      incomeBracket:      this.incomeBracket(),
      showCreator:        !filterUserId,
    });
  }
}
