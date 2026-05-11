import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { KlarDialogService } from '../../shared/ui/klar-dialog.service';
import { PlanspielStore } from '../../core/planspiel/planspiel.store';
import { HlmInputDirective } from '../../shared/ui/hlm/hlm-input.directive';
import { HlmLabelDirective } from '../../shared/ui/hlm/hlm-label.directive';
import { KlarSelectComponent } from '../../shared/ui/klar-select.component';
import { KlarMoneyInputComponent } from '../../shared/ui/klar-money-input.component';
import { KlarDialogFooterComponent } from '../../shared/ui/klar-dialog-footer.component';
import { KlarDialogCalloutComponent } from '../../shared/ui/klar-dialog-callout.component';
import { KlarColorPickerComponent } from '../../shared/ui/klar-color-picker.component';
import { KlarIconPickerComponent } from '../../shared/ui/klar-icon-picker.component';
import { KlarComboboxComponent } from '../../shared/ui/klar-combobox.component';
import { KlarSwitchComponent } from '../../shared/ui/klar-switch.component';
import { KlarPayrollFormComponent, type PayrollApplyEvent } from '../../shared/ui/klar-payroll-form.component';
import type { GrossToNetInput } from '@klar/shared';
import { OverviewStore } from '../../core/overview/overview.store';
import { HouseholdStore } from '../../core/household/household.store';
import { CategoriesStore } from '../../core/categories/categories.store';
import { RecurringTransactionsService } from '../../core/recurring-transactions/recurring-transactions.service';
import { KlarToastService } from '../../shared/ui/klar-toast.service';
import { CategoryEditDialogComponent } from '../haushalt/category-edit-dialog.component';
import type { Category } from '@klar/shared';
import type { RecurringFrequency } from '@klar/shared';
import { safeDayOfMonth } from '@klar/shared';

export interface PrefillSplit {
  label: string;
  amountCents: number;
}

@Component({
  selector: 'app-recurring-create-dialog',
  standalone: true,
  imports: [
    HlmInputDirective, HlmLabelDirective, KlarSelectComponent,
    KlarColorPickerComponent, KlarIconPickerComponent, KlarComboboxComponent,
    KlarMoneyInputComponent, KlarDialogFooterComponent, KlarDialogCalloutComponent,
    KlarSwitchComponent, KlarPayrollFormComponent,
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
  private planspiel  = inject(PlanspielStore);
  protected cats     = inject(CategoriesStore);

  /** When true, the new entry is added to the local PlanspielStore instead of the backend. */
  readonly planspielMode = input<boolean>(false);

  // ── Prefill inputs (used by external triggers, e.g. brutto-netto tool) ──
  readonly prefillName          = input<string>('');
  readonly prefillAmountCents   = input<number | null>(null);
  readonly prefillCategoryId    = input<string | null>(null);
  readonly prefillFrequency     = input<RecurringFrequency | null>(null);
  readonly prefillIcon          = input<string | null>(null);
  readonly prefillColor         = input<string | null>(null);
  readonly prefillPayrollInput  = input<GrossToNetInput | null>(null);
  readonly prefillSplits        = input<PrefillSplit[] | null>(null);

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

  // ── Payroll (Aus Brutto berechnen) — extended to receive prefill ─────
  // (The existing payrollEnabled/payrollInput signals declared further below
  //  are kept; this effect just pre-loads them when prefillPayrollInput is
  //  set by the brutto-netto tool's "In Fixkosten übernehmen" button.)
  constructor() {
    effect(() => {
      // Only seed once per dialog open. The prefill input is static during
      // the dialog lifecycle, so a single read of input() is enough.
      const n     = this.prefillName();
      const amt   = this.prefillAmountCents();
      const catId = this.prefillCategoryId();
      const freq  = this.prefillFrequency();
      const ic    = this.prefillIcon();
      const col   = this.prefillColor();
      const pi    = this.prefillPayrollInput();

      if (n)              this.name.set(n);
      if (amt !== null)   this.amountCents.set(amt);
      if (catId)          this.categoryId.set(catId);
      if (freq)           this.frequency.set(freq);
      if (ic)             this.icon.set(ic);
      if (col)            this.color.set(col);
      if (pi) {
        this.payrollInput.set(pi);
        this.payrollEnabled.set(true);
      }
      // prefillSplits is consumed at save time via this.prefillSplits().
    });
  }

  // ── Payroll (Aus Brutto berechnen) ──────────────────────────
  readonly payrollEnabled = signal(false);
  readonly payrollInput   = signal<GrossToNetInput | null>(null);

  onPayrollApplied(ev: PayrollApplyEvent): void {
    this.amountCents.set(ev.nettoMonthlyCents);
    this.payrollInput.set(ev.input);
  }

  onPayrollToggle(checked: boolean): void {
    this.payrollEnabled.set(checked);
    if (!checked) this.payrollInput.set(null);
  }

  readonly isIncomeContext = computed(() => {
    const a = this.amountCents() ?? 0;
    return a > 0;
  });

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

    if (this.planspielMode()) {
      const cat = this.cats.all().find(c => c.id === this.categoryId());
      this.planspiel.addEntry({
        label:        this.name().trim(),
        amountCents:  actualCents,
        frequency:    freq,
        color:        this.color() ?? cat?.color ?? '#6366f1',
        categoryId:   cat?.id,
        categoryName: cat?.name,
        categoryType: cat?.type,
        categorySortOrder: cat?.sortOrder ?? 0,
      });
      this.saving.set(false);
      this.dialog.close();
      this.toast.success('Im Planspiel hinzugefügt');
      return;
    }

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
        payrollInput: this.payrollEnabled()
          ? (this.payrollInput() as unknown as Record<string, unknown> | null)
          : null,
        splits: this.prefillSplits() ?? undefined,
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
