import { Component, effect, inject, input, signal, computed } from '@angular/core';
import { KlarDialogService } from '../../shared/ui/klar-dialog.service';
import { HlmButtonDirective } from '../../shared/ui/hlm/hlm-button.directive';
import { HlmSpinnerComponent } from '../../shared/ui/hlm/hlm-spinner.component';
import { HlmInputDirective } from '../../shared/ui/hlm/hlm-input.directive';
import { HlmLabelDirective } from '../../shared/ui/hlm/hlm-label.directive';
import { HlmSelectNativeDirective } from '../../shared/ui/hlm/hlm-select/hlm-select-native.directive';
import { KlarColorPickerComponent } from '../../shared/ui/klar-color-picker.component';
import { KlarIconPickerComponent } from '../../shared/ui/klar-icon-picker.component';
import { OverviewStore } from '../../core/overview/overview.store';
import { HouseholdStore } from '../../core/household/household.store';
import { CategoriesStore } from '../../core/categories/categories.store';
import { RecurringTransactionsService } from '../../core/recurring-transactions/recurring-transactions.service';
import { KlarToastService } from '../../shared/ui/klar-toast.service';
import { PlanspielStore } from '../../core/planspiel/planspiel.store';
import type { FixedCostItem } from '../../core/overview/overview.service';
import type { RecurringFrequency } from '@klar/shared';
import { safeDayOfMonth } from '@klar/shared';

@Component({
  selector: 'app-recurring-edit-dialog',
  standalone: true,
  imports: [HlmButtonDirective, HlmSpinnerComponent, HlmInputDirective, HlmLabelDirective, HlmSelectNativeDirective, KlarColorPickerComponent, KlarIconPickerComponent],
  templateUrl: './recurring-edit-dialog.component.html',
  styleUrl: './recurring-edit-dialog.component.css',
})
export class RecurringEditDialogComponent {
  item = input.required<FixedCostItem>();
  planspielMode = input<boolean>(false);

  private dialog     = inject(KlarDialogService);
  private store      = inject(OverviewStore);
  private household  = inject(HouseholdStore);
  private recurring  = inject(RecurringTransactionsService);
  private toast      = inject(KlarToastService);
  private planspielStore = inject(PlanspielStore);
  protected cats     = inject(CategoriesStore);

  readonly name       = signal('');
  readonly monthly    = signal('');
  readonly categoryId = signal('');
  readonly frequency  = signal<RecurringFrequency>('MONTHLY');
  readonly dayOfMonth = signal<string>('');
  readonly color      = signal<string | null>(null);
  readonly icon       = signal<string | null>(null);
  readonly saving     = signal(false);
  readonly err        = signal('');

  constructor() {
    effect(() => {
      const i = this.item();
      this.name.set(i.name);
      this.monthly.set(this.centsToDisplay(i.monthlyEquivalentCents));
      this.categoryId.set(i.categoryId);
      this.frequency.set(i.frequency);
      this.dayOfMonth.set(i.dayOfMonth != null ? String(i.dayOfMonth) : '');
      this.color.set(i.color ?? null);
      this.icon.set(i.icon ?? null);
    });
  }

  readonly isValid = computed(() => {
    const n = this.name().trim();
    const m = this.parseMonthly(this.monthly());
    const c = this.categoryId();
    return n.length > 0 && !isNaN(m) && c.length > 0;
  });

  readonly freqOptions: { value: RecurringFrequency; label: string }[] = [
    { value: 'MONTHLY',   label: 'Monatlich' },
    { value: 'QUARTERLY', label: 'Quartalsweise' },
    { value: 'YEARLY',    label: 'Jährlich' },
  ];

  readonly freqHint = computed(() => {
    const f = this.frequency();
    if (f === 'QUARTERLY') return '× 3 = Quartalsbetrag';
    if (f === 'YEARLY')    return '× 12 = Jahresbetrag';
    return '';
  });

  async save(): Promise<void> {
    if (!this.isValid() || this.saving()) return;

    const monthlyCents = this.parseMonthly(this.monthly());
    const freq         = this.frequency();
    const actualCents  = this.toActualCents(monthlyCents, freq);
    const dom          = parseInt(this.dayOfMonth(), 10);
    const clampedDay   = isNaN(dom) ? null
      : safeDayOfMonth(new Date().getFullYear(), new Date().getMonth() + 1, dom);

    this.saving.set(true);
    this.err.set('');

    if (this.planspielMode()) {
      this.planspielStore.updateEntry(this.item().id, {
        label:        this.name().trim(),
        amountCents: actualCents,
        categoryId:  this.categoryId(),
        frequency:   freq,
      });
      this.dialog.close();
      this.toast.success('Im Planspiel gespeichert');
      this.saving.set(false);
    } else {
      const hid = this.household.activeId();
      if (!hid) return;
      try {
        await this.recurring.patch(hid, this.item().id, {
          name:        this.name().trim(),
          amountCents: actualCents,
          categoryId:  this.categoryId(),
          frequency:   freq,
          dayOfMonth:  clampedDay,
          color:       this.color(),
          icon:        this.icon(),
        });
        this.store.reload();
        this.dialog.close();
        this.toast.success('Gespeichert');
      } catch {
        this.err.set('Speichern fehlgeschlagen. Bitte erneut versuchen.');
      } finally {
        this.saving.set(false);
      }
    }
  }

  async remove(): Promise<void> {
    if (this.saving()) return;

    this.saving.set(true);
    this.err.set('');

    if (this.planspielMode()) {
      this.planspielStore.removeEntry(this.item().id);
      this.dialog.close();
      this.toast.success('Im Planspiel entfernt');
      this.saving.set(false);
    } else {
      const hid = this.household.activeId();
      if (!hid) return;
      try {
        await this.recurring.delete(hid, this.item().id);
        this.store.reload();
        this.dialog.close();
        this.toast.success('Gelöscht');
      } catch {
        this.err.set('Löschen fehlgeschlagen.');
      } finally {
        this.saving.set(false);
      }
    }
  }

  cancel(): void { this.dialog.close(); }

  private centsToDisplay(cents: number): string {
    return (cents / 100).toFixed(2).replace('.', ',');
  }

  private parseMonthly(value: string): number {
    const n = parseFloat(value.replace(',', '.').replace(/[^0-9.\-]/g, ''));
    return Math.round(n * 100);
  }

  private toActualCents(monthlyCents: number, freq: RecurringFrequency): number {
    if (freq === 'QUARTERLY') return Math.round(monthlyCents * 3);
    if (freq === 'YEARLY')    return Math.round(monthlyCents * 12);
    return monthlyCents;
  }
}
