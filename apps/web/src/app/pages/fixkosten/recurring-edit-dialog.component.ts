import { Component, effect, inject, input, signal, computed } from '@angular/core';
import { KlarDialogService } from '../../shared/ui/klar-dialog.service';
import { KlarButtonComponent } from '../../shared/ui/klar-button.component';
import { HlmInputDirective } from '../../shared/ui/hlm/hlm-input.directive';
import { HlmLabelDirective } from '../../shared/ui/hlm/hlm-label.directive';
import { HlmSelectNativeDirective } from '../../shared/ui/hlm/hlm-select/hlm-select-native.directive';
import { KlarColorPickerComponent } from '../../shared/ui/klar-color-picker.component';
import { KlarIconPickerComponent } from '../../shared/ui/klar-icon-picker.component';
import { KlarComboboxComponent } from '../../shared/ui/klar-combobox.component';
import { OverviewStore } from '../../core/overview/overview.store';
import { HouseholdStore } from '../../core/household/household.store';
import { CategoriesStore } from '../../core/categories/categories.store';
import { RecurringTransactionsService } from '../../core/recurring-transactions/recurring-transactions.service';
import { KlarToastService } from '../../shared/ui/klar-toast.service';
import { PlanspielStore } from '../../core/planspiel/planspiel.store';
import { CategoryEditDialogComponent } from '../haushalt/category-edit-dialog.component';
import type { Category } from '@klar/shared';
import type { FixedCostItem } from '../../core/overview/overview.service';
import type { RecurringFrequency } from '@klar/shared';
import { safeDayOfMonth } from '@klar/shared';

@Component({
  selector: 'app-recurring-edit-dialog',
  standalone: true,
  imports: [
    KlarButtonComponent, HlmInputDirective, HlmLabelDirective, HlmSelectNativeDirective,
    KlarColorPickerComponent, KlarIconPickerComponent, KlarComboboxComponent,
  ],
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
  readonly amount     = signal('');
  readonly categoryId = signal<string | null>(null);
  readonly frequency  = signal<RecurringFrequency>('MONTHLY');
  readonly dayOfMonth = signal<string>('');
  readonly dayOfWeek  = signal<string>('1');
  readonly color      = signal<string | null>(null);
  readonly icon       = signal<string | null>(null);
  readonly saving     = signal(false);
  readonly err        = signal('');

  constructor() {
    effect(() => {
      const i = this.item();
      this.name.set(i.name);
      this.amount.set(this.centsToDisplay(i.amountCents));
      this.categoryId.set(i.categoryId);
      this.frequency.set(i.frequency);
      if (i.frequency === 'WEEKLY') {
        this.dayOfWeek.set(i.dayOfMonth != null ? String(i.dayOfMonth) : '1');
        this.dayOfMonth.set('');
      } else {
        this.dayOfMonth.set(i.dayOfMonth != null ? String(i.dayOfMonth) : '');
      }
      this.color.set(i.color ?? null);
      this.icon.set(i.icon ?? null);
    });
  }

  readonly isValid = computed(() => {
    const n = this.name().trim();
    const a = this.parseAmount(this.amount());
    const c = this.categoryId();
    return n.length > 0 && !isNaN(a) && !!c;
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

    const actualCents = this.parseAmount(this.amount());
    const freq        = this.frequency();
    const dom         = this.computeDay(freq);

    this.saving.set(true);
    this.err.set('');

    if (this.planspielMode()) {
      this.planspielStore.updateEntry(this.item().id, {
        label:        this.name().trim(),
        amountCents: actualCents,
        categoryId:  this.categoryId()!,
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
          categoryId:  this.categoryId()!,
          frequency:   freq,
          dayOfMonth:  dom,
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

  private parseAmount(value: string): number {
    const n = parseFloat(value.replace(',', '.').replace(/[^0-9.\-]/g, ''));
    return Math.round(n * 100);
  }

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
