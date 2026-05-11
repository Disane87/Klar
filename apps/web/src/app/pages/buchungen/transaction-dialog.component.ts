import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { KlarDialogService } from '../../shared/ui/klar-dialog.service';
import { KlarButtonComponent } from '../../shared/ui/klar-button.component';
import { HlmInputDirective } from '../../shared/ui/hlm/hlm-input.directive';
import { HlmLabelDirective } from '../../shared/ui/hlm/hlm-label.directive';
import { KlarSelectComponent, type KlarSelectOption } from '../../shared/ui/klar-select.component';
import { KlarComboboxComponent } from '../../shared/ui/klar-combobox.component';
import { KlarMoneyInputComponent } from '../../shared/ui/klar-money-input.component';
import { KlarDateInputComponent } from '../../shared/ui/klar-date-input.component';
import { KlarDialogFooterComponent } from '../../shared/ui/klar-dialog-footer.component';
import { KlarDialogCalloutComponent } from '../../shared/ui/klar-dialog-callout.component';
import { KlarColorPickerComponent } from '../../shared/ui/klar-color-picker.component';
import { KlarIconPickerComponent } from '../../shared/ui/klar-icon-picker.component';
import { CategoriesStore } from '../../core/categories/categories.store';
import { HouseholdStore } from '../../core/household/household.store';
import { TransactionsService } from '../../core/transactions/transactions.service';
import { TransactionsStore } from '../../core/transactions/transactions.store';
import { OverviewStore } from '../../core/overview/overview.store';
import { KlarToastService } from '../../shared/ui/klar-toast.service';
import { CategoryEditDialogComponent } from '../haushalt/category-edit-dialog.component';
import type { Category } from '@klar/shared';
import type { Transaction } from '../../core/transactions/transactions.store';
import { formatBookingText } from '../../shared/transactions/format-booking-text';

@Component({
  selector: 'app-transaction-dialog',
  standalone: true,
  imports: [KlarButtonComponent, HlmInputDirective, HlmLabelDirective, KlarSelectComponent, KlarComboboxComponent, KlarMoneyInputComponent, KlarDateInputComponent, KlarDialogFooterComponent, KlarDialogCalloutComponent, KlarColorPickerComponent, KlarIconPickerComponent],
  templateUrl: './transaction-dialog.component.html',
  styleUrl: './transaction-dialog.component.css',
})
export class TransactionDialogComponent {
  tx = input<Transaction | null>(null);
  /** Pre-filled project id for create mode (used by project detail page). */
  presetProjectId = input<string | null>(null);
  /** When true, the new transaction is created as a planned entry (default false). */
  presetPlanned = input<boolean>(false);
  /** Pre-filled account id for create mode (used when adding from the account detail page). */
  presetAccountId = input<string | null>(null);

  private dialog    = inject(KlarDialogService);
  private household = inject(HouseholdStore);
  private service   = inject(TransactionsService);
  private store     = inject(TransactionsStore);
  private overview  = inject(OverviewStore);
  private toast     = inject(KlarToastService);
  protected cats    = inject(CategoriesStore);

  readonly description = signal('');
  readonly amountCents = signal<number | null>(null);
  readonly date        = signal('');   // YYYY-MM-DD
  readonly categoryId  = signal('');
  readonly visibility  = signal<'SHARED' | 'PRIVATE'>('SHARED');
  readonly isPlanned   = signal(false);
  readonly isPlannedStr = computed(() => String(this.isPlanned()) as 'true' | 'false');

  protected readonly visibilityOpts: KlarSelectOption<'SHARED' | 'PRIVATE'>[] = [
    { value: 'SHARED',  label: 'Geteilt' },
    { value: 'PRIVATE', label: 'Privat' },
  ];
  protected readonly plannedOpts: KlarSelectOption<'true' | 'false'>[] = [
    { value: 'false', label: 'Realisiert' },
    { value: 'true',  label: 'Geplant' },
  ];
  readonly projectId   = signal<string | null>(null);
  readonly accountId   = signal<string | null>(null);
  readonly color       = signal<string | null>(null);
  readonly icon        = signal<string | null>(null);
  readonly saving      = signal(false);
  readonly err         = signal('');

  readonly isEditMode = computed(() => this.tx() !== null);

  /**
   * FinTS Foundation (14a.8): when this transaction was imported via a
   * FinTS sync, bank-side fields (amount, date, description, counterparty)
   * are read-only. The matching backend rules in TransactionsService.update
   * + remove reject mutation attempts as a safety net.
   */
  readonly bankFieldsLocked = computed(() => !!this.tx()?.bankFieldsLockedAt);

  /** Title-cased bank booking-type label ("Folgelastschrift" etc.); empty when unknown. */
  readonly bookingTextLabel = computed(() => formatBookingText(this.tx()?.bookingText));

  /** When editing a planned tx and the user toggles to realized, we show the
   *  archived plan + abweichung hint. */
  readonly realizingNow = computed(() => {
    const t = this.tx();
    return !!t && t.isPlanned && !this.isPlanned();
  });

  readonly deviationCents = computed(() => {
    const t = this.tx();
    if (!t || !this.realizingNow()) return null;
    const a = this.amountCents();
    if (a === null) return null;
    return a - t.amountCents;
  });

  constructor() {
    effect(() => {
      const t = this.tx();
      if (t) {
        this.description.set(t.description ?? '');
        this.amountCents.set(t.amountCents);
        this.date.set(t.date);
        this.categoryId.set(t.categoryId ?? '');
        this.visibility.set(t.visibility);
        this.isPlanned.set(t.isPlanned);
        this.projectId.set(t.projectId ?? null);
        this.accountId.set(t.accountId ?? null);
        this.color.set(t.color ?? null);
        this.icon.set(t.icon ?? null);
      } else {
        this.description.set('');
        this.amountCents.set(null);
        this.date.set(new Date().toISOString().slice(0, 10));
        this.categoryId.set('');
        this.visibility.set('SHARED');
        this.isPlanned.set(this.presetPlanned());
        this.projectId.set(this.presetProjectId());
        this.accountId.set(this.presetAccountId());
        this.color.set(null);
        this.icon.set(null);
      }
    });
  }

  readonly isValid = computed(() => {
    const d = this.description().trim();
    const a = this.amountCents();
    const dt = this.date();
    const c = this.categoryId();
    return d.length > 0 && a !== null && a !== 0 && dt.length === 10 && c.length > 0;
  });

  async save(): Promise<void> {
    if (!this.isValid() || this.saving()) return;
    const hid = this.household.activeId();
    if (!hid) return;

    const body = {
      description: this.description().trim(),
      amountCents: this.amountCents() ?? 0,
      date:        this.date(),
      categoryId:  this.categoryId(),
      visibility:  this.visibility(),
      isPlanned:   this.isPlanned(),
      projectId:   this.projectId(),
      accountId:   this.accountId(),
      color:       this.color(),
      icon:        this.icon(),
    };

    this.saving.set(true);
    this.err.set('');
    try {
      const t = this.tx();
      if (t) {
        await this.service.patch(hid, t.id, body);
        this.toast.success('Gespeichert');
      } else {
        await this.service.create(hid, body);
        this.toast.success('Buchung angelegt');
      }
      this.store.reload();
      this.overview.reload();
      this.dialog.close();
    } catch {
      this.err.set('Speichern fehlgeschlagen. Bitte erneut versuchen.');
    } finally {
      this.saving.set(false);
    }
  }

  async remove(): Promise<void> {
    const t = this.tx();
    const hid = this.household.activeId();
    if (!t || !hid || this.saving()) return;
    this.saving.set(true);
    try {
      await this.service.delete(hid, t.id);
      this.store.reload();
      this.overview.reload();
      this.dialog.close();
      this.toast.success('Buchung gelöscht');
    } catch {
      this.err.set('Löschen fehlgeschlagen.');
    } finally {
      this.saving.set(false);
    }
  }

  cancel(): void { this.dialog.close(); }

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

  protected centsToDisplay(cents: number): string {
    return (cents / 100).toFixed(2).replace('.', ',');
  }
}
