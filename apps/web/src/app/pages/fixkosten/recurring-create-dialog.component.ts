import { Component, computed, effect, inject, signal } from '@angular/core';
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
import type { RecurringFrequency } from '@klar/shared';
import { safeDayOfMonth } from '@klar/shared';

@Component({
  selector: 'app-recurring-create-dialog',
  standalone: true,
  imports: [HlmButtonDirective, HlmSpinnerComponent, HlmInputDirective, HlmLabelDirective, HlmSelectNativeDirective, KlarColorPickerComponent, KlarIconPickerComponent],
  templateUrl: './recurring-create-dialog.component.html',
  styleUrl: './recurring-create-dialog.component.css',
})
export class RecurringCreateDialogComponent {
  private dialog     = inject(KlarDialogService);
  private store      = inject(OverviewStore);
  private household  = inject(HouseholdStore);
  private recurring  = inject(RecurringTransactionsService);
  private toast      = inject(KlarToastService);
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
    const hid = this.household.activeId();
    if (!hid) return;

    const monthlyCents = this.parseMonthly(this.monthly());
    const freq         = this.frequency();
    const actualCents  = this.toActualCents(monthlyCents, freq);
    const dom          = parseInt(this.dayOfMonth(), 10);
    const clampedDay   = isNaN(dom) ? null
      : safeDayOfMonth(new Date().getFullYear(), new Date().getMonth() + 1, dom);

    this.saving.set(true);
    this.err.set('');
    try {
      await this.recurring.create(hid, {
        name:        this.name().trim(),
        amountCents: actualCents,
        categoryId:  this.categoryId(),
        frequency:   freq,
        dayOfMonth:  clampedDay,
        startDate:   new Date().toISOString().slice(0, 10),
        color:       this.color(),
        icon:        this.icon(),
        isActive:    true,
      });
      this.store.reload();
      this.dialog.close();
      this.toast.success('Fixkosten erstellt');
    } catch {
      this.err.set('Erstellen fehlgeschlagen. Bitte erneut versuchen.');
    } finally {
      this.saving.set(false);
    }
  }

  cancel(): void { this.dialog.close(); }

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