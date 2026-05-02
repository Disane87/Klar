import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { KlarDialogService } from '../../shared/ui/klar-dialog.service';
import { KlarButtonComponent } from '../../shared/ui/klar-button.component';
import { CategoriesStore } from '../../core/categories/categories.store';
import { HouseholdStore } from '../../core/household/household.store';
import { TransactionsService } from '../../core/transactions/transactions.service';
import { TransactionsStore } from '../../core/transactions/transactions.store';
import { KlarToastService } from '../../shared/ui/klar-toast.service';
import type { Transaction } from '../../core/transactions/transactions.store';

@Component({
  selector: 'app-transaction-dialog',
  standalone: true,
  imports: [KlarButtonComponent],
  templateUrl: './transaction-dialog.component.html',
  styleUrl: './transaction-dialog.component.css',
})
export class TransactionDialogComponent {
  tx = input<Transaction | null>(null);

  private dialog    = inject(KlarDialogService);
  private household = inject(HouseholdStore);
  private service   = inject(TransactionsService);
  private store     = inject(TransactionsStore);
  private toast     = inject(KlarToastService);
  protected cats    = inject(CategoriesStore);

  readonly description = signal('');
  readonly amount      = signal('');   // display string, e.g. "-50,00"
  readonly date        = signal('');   // YYYY-MM-DD
  readonly categoryId  = signal('');
  readonly visibility  = signal<'SHARED' | 'PRIVATE'>('SHARED');
  readonly saving      = signal(false);
  readonly err         = signal('');

  readonly isEditMode = computed(() => this.tx() !== null);

  constructor() {
    effect(() => {
      const t = this.tx();
      if (t) {
        this.description.set(t.description ?? '');
        this.amount.set(this.centsToDisplay(t.amountCents));
        this.date.set(t.date);
        this.categoryId.set(t.categoryId ?? '');
        this.visibility.set(t.visibility);
      } else {
        this.description.set('');
        this.amount.set('');
        this.date.set(new Date().toISOString().slice(0, 10));
        this.categoryId.set('');
        this.visibility.set('SHARED');
      }
    });
  }

  readonly isValid = computed(() => {
    const d = this.description().trim();
    const a = this.parseCents(this.amount());
    const dt = this.date();
    const c = this.categoryId();
    return d.length > 0 && !isNaN(a) && a !== 0 && dt.length === 10 && c.length > 0;
  });

  async save(): Promise<void> {
    if (!this.isValid() || this.saving()) return;
    const hid = this.household.activeId();
    if (!hid) return;

    const body = {
      description: this.description().trim(),
      amountCents: this.parseCents(this.amount()),
      date:        this.date(),
      categoryId:  this.categoryId(),
      visibility:  this.visibility(),
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
      this.dialog.close();
      this.toast.success('Buchung gelöscht');
    } catch {
      this.err.set('Löschen fehlgeschlagen.');
    } finally {
      this.saving.set(false);
    }
  }

  cancel(): void { this.dialog.close(); }

  private centsToDisplay(cents: number): string {
    return (cents / 100).toFixed(2).replace('.', ',');
  }

  private parseCents(value: string): number {
    const n = parseFloat(value.replace(',', '.').replace(/[^0-9.\-]/g, ''));
    return Math.round(n * 100);
  }
}
