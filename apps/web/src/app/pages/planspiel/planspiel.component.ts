import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { PlanspielStore } from '../../core/planspiel/planspiel.store';
import { KlarConfirmService } from '../../shared/ui/klar-confirm.service';
import { KlarIconComponent } from '../../shared/icons/klar-icon.component';
import { KlarBadgeComponent } from '../../shared/ui/klar-badge.component';
import { PageHeaderService } from '../../core/page-header/page-header.service';
import { HlmInputDirective } from '../../shared/ui/hlm/hlm-input.directive';
import { HlmLabelDirective } from '../../shared/ui/hlm/hlm-label.directive';
import { HlmSelectNativeDirective } from '../../shared/ui/hlm/hlm-select/hlm-select-native.directive';
import { KlarMoneyInputComponent } from '../../shared/ui/klar-money-input.component';
import { KlarButtonComponent } from '../../shared/ui/klar-button.component';
import type { RecurringFrequency } from '@klar/shared';
import { toMonthlyEquivalent } from '@klar/shared';

interface AddForm {
  label: string;
  amountCents: number | null;
  type: 'income' | 'expense';
  frequency: RecurringFrequency;
  color: string;
}

const PRESET_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#64748b',
];

@Component({
  selector: 'app-planspiel',
  standalone: true,
  imports: [FormsModule, KlarIconComponent, KlarBadgeComponent, HlmInputDirective, HlmLabelDirective, HlmSelectNativeDirective, KlarMoneyInputComponent, KlarButtonComponent],
  templateUrl: './planspiel.component.html',
  styleUrl: './planspiel.component.css',
})
export class PlanspielPageComponent {
  protected store = inject(PlanspielStore);
  private confirm = inject(KlarConfirmService);

  protected readonly presetColors = PRESET_COLORS;

  // ── Add-entry form state ───────────────────────────────────────────────────
  protected showForm = signal(false);

  constructor() {
    const router = inject(Router);
    inject(PageHeaderService).set({
      title:       'Planspiel',
      subtitle:    'SIMULATION — REIN LOKAL',
      showAdd:     true,
      addLabel:    'Eintrag',
      onAdd:       () => this.showForm.set(true),
      onPlanspiel: () => router.navigate(['/app/fixkosten']),
    });

    effect(() => {
      if (this.store.isEmpty()) {
        this.showForm.set(false);
      }
    });
  }

  protected form = signal<AddForm>({
    label: '',
    amountCents: null,
    type: 'expense',
    frequency: 'MONTHLY',
    color: PRESET_COLORS[0],
  });

  protected readonly formValid = computed(() => {
    const f = this.form();
    return f.label.trim().length > 0 && f.amountCents !== null && f.amountCents > 0;
  });

  // ── Frequency label helper ─────────────────────────────────────────────────
  frequencyLabel(freq: RecurringFrequency): string {
    switch (freq) {
      case 'WEEKLY':      return 'Wöchentlich';
      case 'MONTHLY':     return 'Monatlich';
      case 'QUARTERLY':   return 'Quartalsweise';
      case 'HALF_YEARLY': return 'Halbjährlich';
      case 'YEARLY':      return 'Jährlich';
      case 'CUSTOM_DAYS': return 'Individuell';
    }
  }

  // ── Monthly equivalent for list display ───────────────────────────────────
  monthlyEquiv(amountCents: number, freq: RecurringFrequency): number {
    return toMonthlyEquivalent(amountCents, freq);
  }

  // ── Currency formatting ────────────────────────────────────────────────────
  formatCents(cents: number): string {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(cents / 100);
  }

  // ── Form actions ──────────────────────────────────────────────────────────
  updateForm(patch: Partial<AddForm>): void {
    this.form.update(f => ({ ...f, ...patch }));
  }

  submitEntry(): void {
    if (!this.formValid()) return;
    const f = this.form();
    const absAmount = Math.abs(f.amountCents ?? 0);
    const amountCents = f.type === 'income' ? absAmount : -absAmount;

    this.store.addEntry({
      label: f.label.trim(),
      amountCents,
      frequency: f.frequency,
      color: f.color,
    });

    // Reset form but keep type/frequency/color for quick repeat entry
    this.form.update(current => ({ ...current, label: '', amountCents: null }));
  }

  openForm(): void {
    this.showForm.set(true);
  }

  closeForm(): void {
    this.showForm.set(false);
    this.form.set({
      label: '',
      amountCents: null,
      type: 'expense',
      frequency: 'MONTHLY',
      color: PRESET_COLORS[0],
    });
  }

  async confirmReset(): Promise<void> {
    if (this.store.entries().length === 0) return;
    const ok = await this.confirm.ask({
      title: 'Planspiel zurücksetzen?',
      message: 'Alle Posten dieser Simulation werden entfernt.',
      detail: 'Daten sind nur lokal gespeichert und können nicht wiederhergestellt werden.',
      confirmLabel: 'Zurücksetzen',
      tone: 'danger',
    });
    if (!ok) return;
    this.store.reset();
  }
}
