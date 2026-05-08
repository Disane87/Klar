import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { StandingOrdersStore } from '../../core/standing-orders/standing-orders.store';
import { FintsStore } from '../../core/fints/fints.store';
import { CategoriesStore } from '../../core/categories/categories.store';
import { KlarDialogService } from '../../shared/ui/klar-dialog.service';
import { KlarToastService } from '../../shared/ui/klar-toast.service';
import { KlarButtonComponent } from '../../shared/ui/klar-button.component';
import { KlarSelectComponent } from '../../shared/ui/klar-select.component';
import { KlarDialogFooterComponent } from '../../shared/ui/klar-dialog-footer.component';
import { KlarDialogCalloutComponent } from '../../shared/ui/klar-dialog-callout.component';
import { KlarIconComponent } from '../../shared/icons/klar-icon.component';
import { HlmInputDirective } from '../../shared/ui/hlm/hlm-input.directive';
import { HlmLabelDirective } from '../../shared/ui/hlm/hlm-label.directive';
import { KlarMoneyInputComponent } from '../../shared/ui/klar-money-input.component';
import type {
  StandingOrder,
  StandingOrderFrequency,
} from '../../core/standing-orders/standing-orders.store';
import type { KlarSelectOption } from '../../shared/ui/klar-select.component';

@Component({
  selector: 'app-standing-order-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    KlarButtonComponent,
    KlarSelectComponent,
    KlarDialogFooterComponent,
    KlarDialogCalloutComponent,
    KlarIconComponent,
    HlmInputDirective,
    HlmLabelDirective,
    KlarMoneyInputComponent,
  ],
  template: `
    <div class="flex flex-col gap-4">

      <!-- Account -->
      <div class="flex flex-col gap-1.5">
        <label hlmLabel>Konto</label>
        <klar-select
          [options]="accountOptions()"
          [value]="accountId()"
          (valueChange)="accountId.set($event)"
          placeholder="Konto wählen …"
          ariaLabel="Konto wählen"
          [disabled]="bankLocked()"
        />
      </div>

      <!-- Counterparty Name -->
      <div class="flex flex-col gap-1.5">
        <label hlmLabel for="sod-name">
          Empfänger / Auftraggeber
          @if (bankLocked()) {
            <klar-icon name="lock" [size]="11" class="ml-1 opacity-60 inline-flex" />
          }
        </label>
        <input
          id="sod-name"
          hlmInput
          type="text"
          placeholder="z.B. Vermieter GmbH"
          [value]="counterpartyName()"
          [disabled]="bankLocked()"
          [class]="bankLocked() ? 'opacity-60' : ''"
          (input)="counterpartyName.set($any($event.target).value)"
        />
      </div>

      <!-- Counterparty IBAN -->
      <div class="flex flex-col gap-1.5">
        <label hlmLabel for="sod-iban">
          IBAN
          @if (bankLocked()) {
            <klar-icon name="lock" [size]="11" class="ml-1 opacity-60 inline-flex" />
          }
        </label>
        <input
          id="sod-iban"
          hlmInput
          type="text"
          placeholder="DE89 …"
          class="font-mono tabular-nums"
          [value]="counterpartyIban()"
          [disabled]="bankLocked()"
          [class]="bankLocked() ? 'opacity-60 font-mono tabular-nums' : 'font-mono tabular-nums'"
          (input)="counterpartyIban.set($any($event.target).value)"
        />
      </div>

      <!-- Amount + Frequency -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div class="flex flex-col gap-1.5">
          <label hlmLabel for="sod-amount">
            Betrag (€)
            @if (bankLocked()) {
              <klar-icon name="lock" [size]="11" class="ml-1 opacity-60 inline-flex" />
            }
          </label>
          <klar-money-input
            inputId="sod-amount"
            placeholder="0,00"
            [(amountCents)]="amountCents"
          />
        </div>

        <div class="flex flex-col gap-1.5">
          <label hlmLabel>
            Frequenz
            @if (bankLocked()) {
              <klar-icon name="lock" [size]="11" class="ml-1 opacity-60 inline-flex" />
            }
          </label>
          <klar-select
            [options]="freqOptions"
            [value]="frequency()"
            (valueChange)="frequency.set($any($event))"
            ariaLabel="Frequenz"
            [disabled]="bankLocked()"
          />
        </div>
      </div>

      <!-- Next expected date -->
      <div class="flex flex-col gap-1.5">
        <label hlmLabel for="sod-next">Nächste Ausführung</label>
        <input
          id="sod-next"
          hlmInput
          type="date"
          [value]="nextExpectedAt()"
          (input)="nextExpectedAt.set($any($event.target).value)"
        />
      </div>

      <!-- Category -->
      <div class="flex flex-col gap-1.5">
        <label hlmLabel>Kategorie</label>
        <klar-select
          [options]="categoryOptions()"
          [value]="categoryId()"
          (valueChange)="categoryId.set($event)"
          placeholder="Kategorie wählen …"
          ariaLabel="Kategorie wählen"
        />
      </div>

      <!-- Note -->
      <div class="flex flex-col gap-1.5">
        <label hlmLabel for="sod-note">Notiz</label>
        <input
          id="sod-note"
          hlmInput
          type="text"
          placeholder="Optional …"
          [value]="note()"
          (input)="note.set($any($event.target).value)"
        />
      </div>

      @if (bankLocked()) {
        <klar-dialog-callout tone="info" icon="lock">
          Bank-Felder (Empfänger, IBAN, Betrag, Frequenz) werden vom FinTS-Sync kontrolliert und
          können nicht manuell geändert werden.
        </klar-dialog-callout>
      }

      @if (err()) {
        <klar-dialog-callout tone="danger" icon="x">
          {{ err() }}
        </klar-dialog-callout>
      }

      <klar-dialog-footer
        [confirmLabel]="mode() === 'create' ? 'Anlegen' : 'Speichern'"
        [confirmDisabled]="!isValid()"
        [confirmLoading]="saving()"
        [autoCloseOnCancel]="false"
        (cancel)="cancel()"
        (confirm)="save()"
      >
        @if (mode() === 'edit' && item()?.source === 'MANUAL') {
          <klar-button
            start
            tone="danger"
            size="sm"
            icon="trash"
            [loading]="saving()"
            (click)="remove()"
          >
            Löschen
          </klar-button>
        }
      </klar-dialog-footer>

    </div>
  `,
})
export class StandingOrderDialogComponent {
  readonly mode = input.required<'create' | 'edit'>();
  readonly item = input<StandingOrder | null>(null);

  private readonly store    = inject(StandingOrdersStore);
  private readonly fintsStore = inject(FintsStore);
  private readonly dialog   = inject(KlarDialogService);
  private readonly toast    = inject(KlarToastService);
  protected readonly cats   = inject(CategoriesStore);

  // ── Form signals ──────────────────────────────────────────────────────────
  readonly accountId       = signal('');
  readonly counterpartyName = signal('');
  readonly counterpartyIban = signal('');
  readonly amountCents     = signal<number | null>(null);
  readonly frequency       = signal<StandingOrderFrequency>('MONTHLY');
  readonly nextExpectedAt  = signal('');
  readonly categoryId      = signal('');
  readonly note            = signal('');
  readonly saving          = signal(false);
  readonly err             = signal('');

  /** True when editing a FINTS_DERIVED record — bank fields become read-only. */
  readonly bankLocked = computed(
    () => this.mode() === 'edit' && this.item()?.source === 'FINTS_DERIVED',
  );

  readonly isValid = computed(() => {
    const a = this.amountCents();
    const acc = this.accountId().trim();
    return acc.length > 0 && a !== null && a !== 0;
  });

  readonly freqOptions: KlarSelectOption<StandingOrderFrequency>[] = [
    { value: 'WEEKLY',      label: 'Wöchentlich' },
    { value: 'MONTHLY',     label: 'Monatlich' },
    { value: 'QUARTERLY',   label: 'Quartalsweise' },
    { value: 'HALF_YEARLY', label: 'Halbjährlich' },
    { value: 'YEARLY',      label: 'Jährlich' },
    { value: 'CUSTOM',      label: 'Individuell' },
    { value: 'UNKNOWN',     label: 'Unbekannt' },
  ];

  readonly accountOptions = computed<KlarSelectOption[]>(() => {
    const conns = this.fintsStore.connections();
    if (!conns) return [];
    return conns.flatMap(c =>
      c.accounts.map((a: { id: string; name: string; iban?: string | null }) => ({
        value: a.id,
        label: `${c.bankName} — ${a.name}${a.iban ? ` (${a.iban})` : ''}`,
      })),
    );
  });

  readonly categoryOptions = computed<KlarSelectOption[]>(() => [
    { value: '', label: '— keine —' },
    ...this.cats.active().map((c: { id: string; name: string }) => ({
      value: c.id,
      label: c.name,
    })),
  ]);

  constructor() {
    // When editing, pre-fill form from the item signal
    effect(() => {
      const i = this.item();
      if (!i) return;
      this.accountId.set(i.accountId);
      this.counterpartyName.set(i.counterpartyName ?? '');
      this.counterpartyIban.set(i.counterpartyIban ?? '');
      this.amountCents.set(i.amountCents);
      this.frequency.set(i.frequency);
      this.nextExpectedAt.set(i.nextExpectedAt ?? '');
      this.categoryId.set(i.categoryId ?? '');
      this.note.set(i.note ?? '');
    });
  }

  async save(): Promise<void> {
    if (!this.isValid() || this.saving()) return;

    this.saving.set(true);
    this.err.set('');

    try {
      if (this.mode() === 'create') {
        await this.store.create({
          accountId:        this.accountId(),
          counterpartyName: this.counterpartyName().trim() || null,
          counterpartyIban: this.counterpartyIban().trim() || null,
          amountCents:      this.amountCents()!,
          frequency:        this.frequency(),
          nextExpectedAt:   this.nextExpectedAt() || null,
          categoryId:       this.categoryId() || null,
          note:             this.note().trim() || null,
        });
        this.toast.success('Dauerauftrag angelegt');
      } else {
        const i = this.item();
        if (!i) return;
        await this.store.update(i.id, {
          counterpartyName: this.counterpartyName().trim() || null,
          counterpartyIban: this.counterpartyIban().trim() || null,
          amountCents:      this.amountCents() ?? undefined,
          frequency:        this.frequency(),
          nextExpectedAt:   this.nextExpectedAt() || null,
          categoryId:       this.categoryId() || null,
          note:             this.note().trim() || null,
        });
        this.toast.success('Gespeichert');
      }
      this.dialog.close();
    } catch {
      this.err.set('Speichern fehlgeschlagen. Bitte erneut versuchen.');
    } finally {
      this.saving.set(false);
    }
  }

  async remove(): Promise<void> {
    const i = this.item();
    if (!i || this.saving()) return;

    const confirmed = window.confirm(
      `Dauerauftrag "${i.counterpartyName ?? 'Eintrag'}" wirklich löschen?`,
    );
    if (!confirmed) return;

    this.saving.set(true);
    this.err.set('');
    try {
      await this.store.remove(i.id);
      this.toast.success('Gelöscht');
      this.dialog.close();
    } catch {
      this.err.set('Löschen fehlgeschlagen.');
    } finally {
      this.saving.set(false);
    }
  }

  cancel(): void {
    this.dialog.close();
  }
}
