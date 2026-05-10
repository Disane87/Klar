import { Component, computed, inject, input, signal } from '@angular/core';
import { KlarDialogService } from '../../shared/ui/klar-dialog.service';
import { HlmInputDirective } from '../../shared/ui/hlm/hlm-input.directive';
import { HlmLabelDirective } from '../../shared/ui/hlm/hlm-label.directive';
import { KlarDialogFooterComponent } from '../../shared/ui/klar-dialog-footer.component';
import { KlarDialogCalloutComponent } from '../../shared/ui/klar-dialog-callout.component';
import { FixedCostsStore } from '../../core/fixed-costs/fixed-costs.store';
import type { FixedCostDto } from '../../core/fixed-costs/fixed-costs.service';
import { KlarToastService } from '../../shared/ui/klar-toast.service';

@Component({
  selector: 'app-contract-extension-dialog',
  standalone: true,
  imports: [
    HlmInputDirective,
    HlmLabelDirective,
    KlarDialogFooterComponent,
    KlarDialogCalloutComponent,
  ],
  template: `
    <form
      class="flex flex-col gap-4"
      (submit)="$event.preventDefault(); save()"
    >
      <div class="grid grid-cols-2 gap-3">
        <div class="flex flex-col gap-1.5">
          <label hlmLabel for="ce-started">Vertrag seit</label>
          <input
            hlmInput
            id="ce-started"
            type="date"
            [value]="contractStartedAt()"
            (input)="contractStartedAt.set($any($event.target).value)"
          />
        </div>

        <div class="flex flex-col gap-1.5">
          <label hlmLabel for="ce-cancel">Kündigen bis</label>
          <input
            hlmInput
            id="ce-cancel"
            type="date"
            [value]="cancelByAt()"
            (input)="cancelByAt.set($any($event.target).value)"
          />
        </div>
      </div>

      <div class="flex flex-col gap-1.5">
        <label hlmLabel for="ce-provider">Anbieter</label>
        <input
          hlmInput
          id="ce-provider"
          [value]="providerName()"
          (input)="providerName.set($any($event.target).value)"
          placeholder="z.B. Spotify AB"
        />
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div class="flex flex-col gap-1.5">
          <label hlmLabel for="ce-holder">Vertragsinhaber</label>
          <input
            hlmInput
            id="ce-holder"
            [value]="contractHolder()"
            (input)="contractHolder.set($any($event.target).value)"
            placeholder="z.B. Marco"
          />
        </div>

        <div class="flex flex-col gap-1.5">
          <label hlmLabel for="ce-number">Vertragsnummer</label>
          <input
            hlmInput
            id="ce-number"
            [value]="contractNumber()"
            (input)="contractNumber.set($any($event.target).value)"
            placeholder="ABC-12345"
          />
        </div>
      </div>

      <div class="flex flex-col gap-1.5">
        <label hlmLabel for="ce-doc">Dokument-URL (optional)</label>
        <input
          hlmInput
          id="ce-doc"
          [value]="documentUrl()"
          (input)="documentUrl.set($any($event.target).value)"
          placeholder="https://…"
        />
      </div>

      <div class="flex flex-col gap-1.5">
        <label hlmLabel for="ce-notes">Notizen</label>
        <input
          hlmInput
          id="ce-notes"
          [value]="notes()"
          (input)="notes.set($any($event.target).value)"
          placeholder="Frei-Text"
        />
      </div>

      @if (err()) {
        <klar-dialog-callout tone="danger" icon="x">
          {{ err() }}
        </klar-dialog-callout>
      }

      <klar-dialog-footer
        [confirmLabel]="hasContract() ? 'Speichern' : 'Als Vertrag markieren'"
        [confirmDisabled]="saving()"
        [confirmLoading]="saving()"
        (confirm)="save()"
      />
    </form>
  `,
})
export class ContractExtensionDialogComponent {
  protected readonly dialog = inject(KlarDialogService);
  private readonly store = inject(FixedCostsStore);
  private readonly toast = inject(KlarToastService);

  readonly fixedCost = input.required<FixedCostDto>();

  readonly contractStartedAt = signal('');
  readonly cancelByAt = signal('');
  readonly contractHolder = signal('');
  readonly contractNumber = signal('');
  readonly providerName = signal('');
  readonly documentUrl = signal('');
  readonly notes = signal('');
  readonly saving = signal(false);
  readonly err = signal('');

  protected readonly hasContract = computed(() => !!this.fixedCost().contract);

  constructor() {
    queueMicrotask(() => this.hydrate());
  }

  private hydrate(): void {
    const c = this.fixedCost().contract;
    if (!c) return;
    this.contractStartedAt.set(c.contractStartedAt ?? '');
    this.cancelByAt.set(c.cancelByAt ?? '');
    this.contractHolder.set(c.contractHolder ?? '');
    this.contractNumber.set(c.contractNumber ?? '');
    this.providerName.set(c.providerName ?? '');
    this.documentUrl.set(c.documentUrl ?? '');
    this.notes.set(c.notes ?? '');
  }

  protected async save(): Promise<void> {
    this.saving.set(true);
    this.err.set('');
    try {
      const body = {
        contractStartedAt: this.contractStartedAt() || null,
        cancelByAt: this.cancelByAt() || null,
        contractHolder: this.contractHolder().trim() || null,
        contractNumber: this.contractNumber().trim() || null,
        providerName: this.providerName().trim() || null,
        documentUrl: this.documentUrl().trim() || null,
        notes: this.notes().trim() || null,
      };
      const id = this.fixedCost().id;
      const result = this.hasContract()
        ? await this.store.updateContract(id, body)
        : await this.store.promoteToContract(id, body);
      if (!result) {
        this.err.set('Speichern fehlgeschlagen');
        return;
      }
      this.toast.success(this.hasContract() ? 'Vertragsdaten aktualisiert' : 'Als Vertrag markiert');
      this.dialog.close();
    } catch (e) {
      this.err.set((e as Error).message ?? 'Unerwarteter Fehler');
    } finally {
      this.saving.set(false);
    }
  }
}
