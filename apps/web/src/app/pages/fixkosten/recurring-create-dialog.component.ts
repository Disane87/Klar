import { Component, computed, inject, signal } from '@angular/core';
import { KlarDialogService } from '../../shared/ui/klar-dialog.service';
import { HlmInputDirective } from '../../shared/ui/hlm/hlm-input.directive';
import { HlmLabelDirective } from '../../shared/ui/hlm/hlm-label.directive';
import { HlmSelectNativeDirective } from '../../shared/ui/hlm/hlm-select/hlm-select-native.directive';
import { KlarMoneyInputComponent } from '../../shared/ui/klar-money-input.component';
import { KlarDialogFooterComponent } from '../../shared/ui/klar-dialog-footer.component';
import { KlarColorPickerComponent } from '../../shared/ui/klar-color-picker.component';
import { KlarIconPickerComponent } from '../../shared/ui/klar-icon-picker.component';
import { KlarComboboxComponent } from '../../shared/ui/klar-combobox.component';
import { OverviewStore } from '../../core/overview/overview.store';
import { HouseholdStore } from '../../core/household/household.store';
import { CategoriesStore } from '../../core/categories/categories.store';
import { RecurringTransactionsService } from '../../core/recurring-transactions/recurring-transactions.service';
import { KlarToastService } from '../../shared/ui/klar-toast.service';
import { CategoryEditDialogComponent } from '../haushalt/category-edit-dialog.component';
import type { Category } from '@klar/shared';
import type { RecurringFrequency } from '@klar/shared';
import { safeDayOfMonth } from '@klar/shared';

@Component({
  selector: 'app-recurring-create-dialog',
  standalone: true,
  imports: [
    HlmInputDirective, HlmLabelDirective, HlmSelectNativeDirective,
    KlarColorPickerComponent, KlarIconPickerComponent, KlarComboboxComponent,
    KlarMoneyInputComponent, KlarDialogFooterComponent,
  ],
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
  readonly amountCents = signal<number | null>(null);
  readonly categoryId = signal<string | null>(null);
  readonly frequency  = signal<RecurringFrequency>('MONTHLY');
  readonly dayOfMonth = signal<string>('');
  readonly dayOfWeek  = signal<string>('1');
  readonly color      = signal<string | null>(null);
  readonly icon       = signal<string | null>(null);
  readonly saving     = signal(false);
  readonly err        = signal('');

  readonly isValid = computed(() => {
    const n = this.name().trim();
    const a = this.amountCents();
    const c = this.categoryId();
    return n.length > 0 && a !== null && !!c;
  });

  readonly freqOptions: { value: RecurringFrequency; label: string }[] = [
    { value: 'WEEKLY',      label: 'Wöchentlich' },
    { value: 'MONTHLY',     label: 'Monatlich' },
    { value: 'QUARTERLY',   label: 'Quartalsweise' },
    { value: 'HALF_YEARLY', label: 'Halbjährlich' },
    { value: 'YEARLY',      label: 'Jährlich' },
  ];

  readonly weekdayOptions = [
    { value: '1', label: 'Montag' },
    { value: '2', label: 'Dienstag' },
    { value: '3', label: 'Mittwoch' },
    { value: '4', label: 'Donnerstag' },
    { value: '5', label: 'Freitag' },
    { value: '6', label: 'Samstag' },
    { value: '7', label: 'Sonntag' },
  ];

  readonly amountLabel = computed(() => {
    switch (this.frequency()) {
      case 'WEEKLY':      return 'Betrag / Woche (€)';
      case 'MONTHLY':     return 'Betrag / Monat (€)';
      case 'QUARTERLY':   return 'Betrag / Quartal (€)';
      case 'HALF_YEARLY': return 'Betrag / Halbjahr (€)';
      case 'YEARLY':      return 'Betrag / Jahr (€)';
      default:            return 'Betrag (€)';
    }
  });

  readonly isWeekly = computed(() => this.frequency() === 'WEEKLY');

  readonly addCategoryLabel = (q: string) => `"${q}" als neue Kategorie anlegen`;
  readonly catId = (c: Category) => c.id;
  readonly catName = (c: Category) => c.name;

  onAddCategory(name: string): void {
    this.dialog.open({
      title: 'Kategorie anlegen',
      component: CategoryEditDialogComponent,
      width: 'md',
      inputs: {
        category: null,
        prefillName: name,
        onCreated: (created: Category) => this.categoryId.set(created.id),
      },
    });
  }

  async save(): Promise<void> {
    if (!this.isValid() || this.saving()) return;
    const hid = this.household.activeId();
    if (!hid) return;

    const actualCents = this.amountCents() ?? 0;
    const freq        = this.frequency();
    const dom         = this.computeDay(freq);

    this.saving.set(true);
    this.err.set('');
    try {
      await this.recurring.create(hid, {
        name:        this.name().trim(),
        amountCents: actualCents,
        categoryId:  this.categoryId()!,
        frequency:   freq,
        dayOfMonth:  dom,
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

  private computeDay(freq: RecurringFrequency): number | null {
    if (freq === 'WEEKLY') {
      const w = parseInt(this.dayOfWeek(), 10);
      return isNaN(w) ? null : w;
    }
    const dom = parseInt(this.dayOfMonth(), 10);
    if (isNaN(dom)) return null;
    return safeDayOfMonth(new Date().getFullYear(), new Date().getMonth() + 1, dom);
  }
}
