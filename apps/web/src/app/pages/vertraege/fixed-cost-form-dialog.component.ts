import { Component, computed, inject, input, signal } from '@angular/core';
import { KlarDialogService } from '../../shared/ui/klar-dialog.service';
import { HlmInputDirective } from '../../shared/ui/hlm/hlm-input.directive';
import { HlmLabelDirective } from '../../shared/ui/hlm/hlm-label.directive';
import { KlarSelectComponent } from '../../shared/ui/klar-select.component';
import { KlarMoneyInputComponent } from '../../shared/ui/klar-money-input.component';
import { KlarDialogFooterComponent } from '../../shared/ui/klar-dialog-footer.component';
import { KlarDialogCalloutComponent } from '../../shared/ui/klar-dialog-callout.component';
import { FixedCostsStore } from '../../core/fixed-costs/fixed-costs.store';
import type {
  FixedCostCycle,
  FixedCostDto,
} from '../../core/fixed-costs/fixed-costs.service';
import { KlarToastService } from '../../shared/ui/klar-toast.service';

const CYCLE_OPTIONS: { value: FixedCostCycle; label: string }[] = [
  { value: 'WEEKLY',      label: 'Wöchentlich' },
  { value: 'MONTHLY',     label: 'Monatlich' },
  { value: 'QUARTERLY',   label: 'Quartalsweise' },
  { value: 'HALF_YEARLY', label: 'Halbjährlich' },
  { value: 'YEARLY',      label: 'Jährlich' },
  { value: 'CUSTOM',      label: 'Individuell' },
];

@Component({
  selector: 'app-fixed-cost-form-dialog',
  standalone: true,
  imports: [
    HlmInputDirective,
    HlmLabelDirective,
    KlarSelectComponent,
    KlarMoneyInputComponent,
    KlarDialogFooterComponent,
    KlarDialogCalloutComponent,
  ],
  template: `
    <form
      class="flex flex-col gap-4"
      (submit)="$event.preventDefault(); save()"
    >
      <div class="flex flex-col gap-1.5">
        <label hlmLabel for="fc-name">Bezeichnung</label>
        <input
          hlmInput
          id="fc-name"
          [value]="name()"
          (input)="name.set($any($event.target).value)"
          placeholder="z.B. Spotify Family"
          autofocus
        />
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div class="flex flex-col gap-1.5">
          <label hlmLabel for="fc-amount">Betrag (€)</label>
          <klar-money-input
            inputId="fc-amount"
            [(amountCents)]="amountCents"
            placeholder="-9,99"
          />
          <span class="text-[11px] text-(--fg-3)">
            Negativ = Ausgabe, positiv = Einnahme
          </span>
        </div>

        <div class="flex flex-col gap-1.5">
          <label hlmLabel for="fc-cycle">Zyklus</label>
          <klar-select
            [options]="cycleOptions"
            [(value)]="cycle"
          />
        </div>
      </div>

      <div class="flex flex-col gap-1.5">
        <label hlmLabel for="fc-merchant">Empfänger / Merchant (optional)</label>
        <input
          hlmInput
          id="fc-merchant"
          [value]="merchant()"
          (input)="merchant.set($any($event.target).value)"
          placeholder="z.B. Spotify AB"
        />
      </div>

      <div class="flex flex-col gap-1.5">
        <label hlmLabel for="fc-renewal">Nächste Abbuchung (optional)</label>
        <input
          hlmInput
          id="fc-renewal"
          type="date"
          [value]="nextRenewalAt()"
          (input)="nextRenewalAt.set($any($event.target).value)"
        />
      </div>

      @if (err()) {
        <klar-dialog-callout tone="danger" icon="x">
          {{ err() }}
        </klar-dialog-callout>
      }

      <klar-dialog-footer
        [confirmLabel]="editing() ? 'Speichern' : 'Anlegen'"
        [confirmDisabled]="!isValid()"
        [confirmLoading]="saving()"
        (confirm)="save()"
      />
    </form>
  `,
})
export class FixedCostFormDialogComponent {
  protected readonly dialog = inject(KlarDialogService);
  private readonly store = inject(FixedCostsStore);
  private readonly toast = inject(KlarToastService);

  /** When set, the dialog is in edit mode for that fixed cost. */
  readonly editing = input<FixedCostDto | null>(null);

  readonly name = signal('');
  readonly amountCents = signal<number | null>(null);
  readonly cycle = signal<FixedCostCycle>('MONTHLY');
  readonly merchant = signal('');
  readonly nextRenewalAt = signal('');
  readonly saving = signal(false);
  readonly err = signal('');

  protected readonly cycleOptions = CYCLE_OPTIONS;

  protected readonly isValid = computed(() => {
    const n = this.name().trim();
    const a = this.amountCents();
    return n.length > 0 && a !== null && a !== 0;
  });

  constructor() {
    queueMicrotask(() => this.hydrateForEdit());
  }

  private hydrateForEdit(): void {
    const fc = this.editing();
    if (!fc) return;
    this.name.set(fc.name);
    this.amountCents.set(fc.amountCents);
    this.cycle.set(fc.cycle);
    this.merchant.set(fc.merchant ?? '');
    this.nextRenewalAt.set(fc.nextRenewalAt ?? '');
  }

  protected async save(): Promise<void> {
    if (!this.isValid()) return;
    this.saving.set(true);
    this.err.set('');
    try {
      const body = {
        name: this.name().trim(),
        amountCents: this.amountCents()!,
        cycle: this.cycle(),
        merchant: this.merchant().trim() || null,
        nextRenewalAt: this.nextRenewalAt() || null,
      };
      const existing = this.editing();
      const result = existing
        ? await this.store.update(existing.id, body)
        : await this.store.create(body);
      if (!result) {
        this.err.set('Speichern fehlgeschlagen');
        return;
      }
      this.toast.success(existing ? 'Fixkosten aktualisiert' : 'Fixkosten angelegt');
      this.dialog.close();
    } catch (e) {
      this.err.set((e as Error).message ?? 'Unerwarteter Fehler');
    } finally {
      this.saving.set(false);
    }
  }
}
