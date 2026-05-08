import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { HouseholdStore } from '../../core/household/household.store';
import { FintsStore } from '../../core/fints/fints.store';
import {
  FintsService,
  type FintsBankLookupRecord,
  type FintsCreateConnectionResponse,
  type FintsDiscoveredAccount,
  type FintsSyncRunWithChallenge,
  type FintsTanChallenge,
} from '../../core/fints/fints.service';
import { KlarInputComponent } from '../../shared/ui/klar-input.component';
import { KlarButtonComponent } from '../../shared/ui/klar-button.component';
import { KlarComboboxComponent } from '../../shared/ui/klar-combobox.component';
import { KlarIconComponent } from '../../shared/icons/klar-icon.component';
import { KlarDialogService } from '../../shared/ui/klar-dialog.service';

type WizardStep = 'bank' | 'credentials' | 'tan' | 'accounts' | 'done' | 'failed';

interface StepDef {
  id: WizardStep;
  label: string;
  index: number;
}

const STEPS: readonly StepDef[] = [
  { id: 'bank',        label: 'Bank',    index: 1 },
  { id: 'credentials', label: 'Login',   index: 2 },
  { id: 'tan',         label: 'TAN',     index: 3 },
  { id: 'accounts',    label: 'Konten',  index: 4 },
];

interface AccountSelection {
  ref: string;
  name: string;
  iban?: string;
  bic?: string;
  selected: boolean;
}

/**
 * FinTS setup wizard (Phase 14a.6 UI).
 *
 * 4 steps wrapped inside a single dialog:
 *   1. bank        — BLZ input + lookup, fills name + URL
 *   2. credentials — login name + PIN; sends POST /connections
 *   3. tan         — surfaces tanChallenge; user submits TAN
 *   4. accounts    — discovered sub-accounts; user picks which to attach
 *
 * On success: lands on `done`. On error: `failed` with retry button.
 *
 * The component is rendered inside KlarDialogComponent's content slot,
 * so it does not bring its own header/footer chrome — only the wizard
 * body. The dialog title comes from KlarDialogService.open().
 */
@Component({
  selector: 'klar-fints-setup-wizard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    KlarInputComponent,
    KlarButtonComponent,
    KlarComboboxComponent,
    KlarIconComponent,
  ],
  template: `
    <div class="flex flex-col gap-4">
      <!-- Stepper: numbered circles connected by progress lines. The
           current step lights up in the accent tone, finished steps go
           emerald with a check mark. -->
      <ol class="flex items-center justify-between gap-1 px-1">
        @for (s of steps; track s.id; let last = $last) {
          <li class="flex items-center gap-1 flex-1" [class.flex-none]="last">
            <div class="flex flex-col items-center gap-1 shrink-0">
              <span
                class="grid place-items-center size-7 rounded-full border text-[11px] mono font-medium transition-colors"
                [class.bg-success]="isStepDone(s.id)"
                [class.text-success-foreground]="isStepDone(s.id)"
                [class.border-success]="isStepDone(s.id)"
                [class.bg-accent]="isStepActive(s.id)"
                [class.text-accent-foreground]="isStepActive(s.id)"
                [class.border-accent]="isStepActive(s.id)"
                [class.bg-transparent]="isStepPending(s.id)"
                [class.text-muted-foreground]="isStepPending(s.id)"
                [class.border-border]="isStepPending(s.id)"
              >
                @if (isStepDone(s.id)) {
                  <klar-icon name="check" [size]="12" />
                } @else {
                  {{ s.index }}
                }
              </span>
              <span
                class="text-[10px] uppercase tracking-widest"
                [class.text-foreground]="isStepActive(s.id)"
                [class.text-success]="isStepDone(s.id)"
                [class.text-muted-foreground]="isStepPending(s.id)"
              >{{ s.label }}</span>
            </div>
            @if (!last) {
              <span
                class="flex-1 h-px transition-colors"
                [class.bg-success]="isStepDone(s.id)"
                [class.bg-border]="!isStepDone(s.id)"
              ></span>
            }
          </li>
        }
      </ol>

      <hr class="border-(--line-soft)" />

      @if (step() === 'bank') {
        <section class="flex flex-col gap-3">
          <p class="text-[13px] text-(--fg-2)">
            Suche deine Bank — per Name oder Bankleitzahl. Klar findet die
            FinTS-Endpunkt-Adresse automatisch.
          </p>
          <div class="flex flex-col gap-1.5">
            <label class="text-[11px] uppercase tracking-widest text-(--fg-2)">Bank</label>
            <klar-combobox
              [items]="banks()"
              [value]="blz() || null"
              (valueChange)="onBankPicked($event)"
              [idOf]="bankId"
              [displayWith]="bankLabel"
              [loading]="banksLoading()"
              placeholder="Bank suchen oder BLZ eintippen…"
              searchPlaceholder="Name oder BLZ…"
              ariaLabel="Bank wählen"
            />
            <span class="text-[11px] text-(--fg-3)">
              Falls deine Bank nicht in der Liste ist, kannst du URL und Name manuell ergänzen.
            </span>
          </div>
          @if (lookupError()) {
            <div class="text-[12px] text-(--danger)">{{ lookupError() }}</div>
          }
          <klar-input
            label="FinTS-Server (URL)"
            type="text"
            placeholder="https://…/fints"
            iconName="link"
            [ngModel]="serverUrl()"
            (ngModelChange)="serverUrl.set($event)"
          />
          <klar-input
            label="Anzeigename"
            type="text"
            placeholder="z. B. Sparkasse Köln"
            [ngModel]="bankName()"
            (ngModelChange)="bankName.set($event)"
          />
          <div class="flex justify-end gap-2 pt-1">
            <klar-button tone="ghost" (click)="cancel()">Abbrechen</klar-button>
            <klar-button
              tone="primary"
              [disabled]="!canProceedFromBank()"
              (click)="goCredentials()"
            >Weiter</klar-button>
          </div>
        </section>
      }

      @if (step() === 'credentials') {
        <section class="flex flex-col gap-3">
          <p class="text-[13px] text-(--fg-2)">
            Anmeldedaten deines Online-Bankings. Werden AES-256-GCM-verschlüsselt gespeichert.
          </p>
          <klar-input
            label="Anmeldename / VR-Kennung"
            type="text"
            iconName="user"
            [ngModel]="loginName()"
            (ngModelChange)="loginName.set($event)"
          />
          <klar-input
            label="PIN"
            type="password"
            iconName="lock"
            [ngModel]="pin()"
            (ngModelChange)="pin.set($event)"
            hint="Bleibt verschlüsselt im Server. Niemals im Log."
          />
          @if (createError()) {
            <div class="text-[12px] text-(--danger)">{{ createError() }}</div>
          }
          <div class="flex justify-between gap-2 pt-2">
            <klar-button tone="ghost" (click)="step.set('bank')">Zurück</klar-button>
            <klar-button
              tone="primary"
              [disabled]="!canSubmitCredentials() || creating()"
              (click)="submitCredentials()"
            >
              {{ creating() ? 'Verbinde …' : 'Verbinden' }}
            </klar-button>
          </div>
        </section>
      }

      @if (step() === 'tan') {
        <section class="flex flex-col gap-3">
          <p class="text-[13px] text-(--fg-2)">
            {{ tanChallenge()?.prompt ?? 'Bestätige die Anmeldung mit einer TAN.' }}
          </p>
          @if (tanChallenge()?.mediaBase64) {
            <img
              class="rounded-md border border-(--line-soft) self-start"
              [src]="tanImageSrc()"
              alt="TAN challenge"
              style="max-width: 240px;"
            />
          }
          <klar-input
            label="TAN"
            type="text"
            placeholder="6-stellige TAN oder leer für Push-Bestätigung"
            iconName="shield-check"
            [ngModel]="tan()"
            (ngModelChange)="tan.set($event)"
            hint="Push-/Decoupled-Verfahren: Eingabe leer lassen und in der Banking-App bestätigen."
          />
          @if (tanError()) {
            <div class="text-[12px] text-(--danger)">{{ tanError() }}</div>
          }
          <div class="flex justify-between gap-2 pt-2">
            <klar-button tone="ghost" (click)="cancel()">Abbrechen</klar-button>
            <klar-button
              tone="primary"
              [disabled]="store.tanSubmitting()"
              (click)="submitTan()"
            >
              {{ store.tanSubmitting() ? 'Sende …' : 'Bestätigen' }}
            </klar-button>
          </div>
        </section>
      }

      @if (step() === 'accounts') {
        <section class="flex flex-col gap-3">
          <p class="text-[13px] text-(--fg-2)">
            Welche Konten möchtest du in Klar verbinden? Spätere Buchungen aller markierten
            Konten werden automatisch synchronisiert.
          </p>
          @if (loadingAccounts()) {
            <div class="text-[13px] text-(--fg-2)">Lade Konten …</div>
          } @else if (accountSelections().length === 0) {
            <div class="text-[13px] text-(--fg-2)">
              Deine Bank hat keine FinTS-fähigen Konten gemeldet.
            </div>
          } @else {
            <ul class="flex flex-col gap-2">
              @for (a of accountSelections(); track a.ref; let i = $index) {
                <li
                  class="flex items-center gap-3 px-3 py-2 rounded-md border border-(--line-soft) bg-(--bg-1)"
                >
                  <input
                    type="checkbox"
                    [checked]="a.selected"
                    (change)="toggleAccount(i, $event)"
                    [attr.aria-label]="a.name"
                    class="size-4 accent-(--accent)"
                  />
                  <div class="flex-1 min-w-0">
                    <div class="text-[14px] font-medium truncate">{{ a.name }}</div>
                    @if (a.iban) {
                      <div class="text-[11px] text-(--fg-2) mono truncate">{{ a.iban }}</div>
                    }
                  </div>
                </li>
              }
            </ul>
          }
          @if (attachError()) {
            <div class="text-[12px] text-(--danger)">{{ attachError() }}</div>
          }
          <div class="flex justify-end gap-2 pt-2">
            <klar-button
              tone="primary"
              [disabled]="!canAttach() || attaching()"
              (click)="attach()"
            >
              {{ attaching() ? 'Verknüpfe …' : 'Konten verknüpfen' }}
            </klar-button>
          </div>
        </section>
      }

      @if (step() === 'done') {
        <section class="flex flex-col items-center text-center gap-3 py-6">
          <klar-icon name="shield-check" [size]="36" class="text-(--success)" />
          <span class="text-[16px] font-medium">Verbindung eingerichtet</span>
          <span class="text-[13px] text-(--fg-2) max-w-prose">
            Dein Bankkonto ist verknüpft. Klar holt Buchungen täglich automatisch und meldet sich,
            wenn die nächste TAN-Bestätigung fällig ist (alle 90 Tage per PSD2).
          </span>
          <klar-button tone="primary" (click)="dismiss()">Fertig</klar-button>
        </section>
      }

      @if (step() === 'failed') {
        <section class="flex flex-col items-center text-center gap-3 py-6">
          <klar-icon name="x" [size]="36" class="text-(--danger)" />
          <span class="text-[16px] font-medium">Verbindung fehlgeschlagen</span>
          @if (failureMessage()) {
            <span class="text-[13px] text-(--fg-2) max-w-prose">{{ failureMessage() }}</span>
          }
          <div class="flex gap-2">
            <klar-button tone="ghost" (click)="dismiss()">Schließen</klar-button>
            <klar-button tone="primary" (click)="retry()">Nochmal versuchen</klar-button>
          </div>
        </section>
      }
    </div>
  `,
})
export class FintsSetupWizardComponent implements OnInit {
  protected readonly store = inject(FintsStore);
  private readonly fintsService = inject(FintsService);
  private readonly householdStore = inject(HouseholdStore);
  private readonly dialog = inject(KlarDialogService);

  protected readonly steps = STEPS;
  protected readonly step = signal<WizardStep>('bank');

  // Step 1: bank
  protected readonly blz = signal('');
  protected readonly bankName = signal('');
  protected readonly serverUrl = signal('');
  protected readonly lookupError = signal<string | null>(null);
  protected readonly banks = signal<FintsBankLookupRecord[]>([]);
  protected readonly banksLoading = signal(false);

  /** Combobox accessors — kept as arrow props so Angular can pass them by reference. */
  protected readonly bankId = (b: FintsBankLookupRecord) => b.blz;
  protected readonly bankLabel = (b: FintsBankLookupRecord) =>
    `${b.blz} · ${b.name}${b.city ? ` · ${b.city}` : ''}`;

  // Step 2: credentials
  protected readonly loginName = signal('');
  protected readonly pin = signal('');
  protected readonly creating = signal(false);
  protected readonly createError = signal<string | null>(null);
  private connectionId: string | null = null;

  // Step 3: TAN
  protected readonly tan = signal('');
  protected readonly tanChallenge = signal<FintsTanChallenge | null>(null);
  protected readonly tanError = signal<string | null>(null);
  private syncRunId: string | null = null;

  // Step 4: accounts
  protected readonly loadingAccounts = signal(false);
  protected readonly accountSelections = signal<AccountSelection[]>([]);
  protected readonly attaching = signal(false);
  protected readonly attachError = signal<string | null>(null);

  protected readonly failureMessage = signal<string | null>(null);

  protected readonly canProceedFromBank = computed(
    () => /^[0-9]{8}$/.test(this.blz()) && this.bankName().trim().length > 0 && this.serverUrl().trim().length > 0,
  );

  // ── Stepper status ──────────────────────────────────────────────────────────

  private readonly stepOrder = STEPS.map(s => s.id);
  private readonly currentIndex = computed(() => this.stepOrder.indexOf(this.step()));

  protected isStepActive(id: WizardStep): boolean {
    return this.step() === id;
  }
  protected isStepDone(id: WizardStep): boolean {
    const idx = this.stepOrder.indexOf(id);
    if (this.step() === 'done' || this.step() === 'failed') {
      // Failed branch — keep all 4 outlined; only success marks them green.
      return this.step() === 'done';
    }
    return idx >= 0 && idx < this.currentIndex();
  }
  protected isStepPending(id: WizardStep): boolean {
    return !this.isStepActive(id) && !this.isStepDone(id);
  }

  protected readonly canSubmitCredentials = computed(
    () => this.loginName().trim().length > 0 && this.pin().length > 0,
  );

  protected readonly canAttach = computed(
    () => this.accountSelections().some(a => a.selected),
  );

  protected readonly tanImageSrc = computed(() => {
    const c = this.tanChallenge();
    if (!c?.mediaBase64) return '';
    const mime = c.mediaMimeType ?? 'image/png';
    return `data:${mime};base64,${c.mediaBase64}`;
  });

  ngOnInit(): void {
    void this.loadBanks();
  }

  private async loadBanks(): Promise<void> {
    const householdId = this.householdStore.activeId();
    if (!householdId) return;
    this.banksLoading.set(true);
    try {
      const list = await firstValueFrom(this.fintsService.listBanks(householdId));
      this.banks.set(list);
    } catch {
      this.lookupError.set('Bankliste konnte nicht geladen werden — du kannst BLZ und URL manuell eintragen.');
    } finally {
      this.banksLoading.set(false);
    }
  }

  /** Combobox-Auswahl: BLZ als id → Name + URL aus dem Record vorausfüllen. */
  protected onBankPicked(blz: string | null): void {
    this.lookupError.set(null);
    if (!blz) {
      this.blz.set('');
      this.bankName.set('');
      this.serverUrl.set('');
      return;
    }
    this.blz.set(blz);
    const record = this.banks().find(b => b.blz === blz);
    if (record) {
      this.bankName.set(record.name);
      this.serverUrl.set(record.pinTanUrl ?? '');
    }
  }

  protected goCredentials(): void {
    this.step.set('credentials');
    this.createError.set(null);
  }

  protected async submitCredentials(): Promise<void> {
    this.creating.set(true);
    this.createError.set(null);
    try {
      const result: FintsCreateConnectionResponse = await this.store.createConnection({
        bankName: this.bankName().trim(),
        blz: this.blz(),
        serverUrl: this.serverUrl().trim(),
        loginName: this.loginName().trim(),
        pin: this.pin(),
      });
      this.pin.set(''); // wipe local copy
      this.connectionId = result.connection.id;
      this.syncRunId = result.syncRun.id;
      if (result.tanChallenge) {
        this.tanChallenge.set(result.tanChallenge);
        this.step.set('tan');
      } else {
        await this.proceedToAccounts();
      }
    } catch (err) {
      this.createError.set((err as { error?: { detail?: string } })?.error?.detail ?? 'Verbindung fehlgeschlagen.');
    } finally {
      this.creating.set(false);
    }
  }

  protected async submitTan(): Promise<void> {
    if (!this.syncRunId) return;
    this.tanError.set(null);
    try {
      const result: FintsSyncRunWithChallenge = await this.store.submitTan(this.syncRunId, this.tan());
      this.tan.set('');
      if (result.tanChallenge) {
        this.tanChallenge.set(result.tanChallenge);
        return; // bank chained another TAN
      }
      this.tanChallenge.set(null);
      await this.proceedToAccounts();
    } catch (err) {
      this.tanError.set((err as { error?: { detail?: string } })?.error?.detail ?? 'TAN-Bestätigung fehlgeschlagen.');
    }
  }

  private async proceedToAccounts(): Promise<void> {
    this.step.set('accounts');
    this.loadingAccounts.set(true);
    try {
      const householdId = this.householdStore.activeId();
      if (!householdId || !this.connectionId) return;
      const accounts = await new Promise<FintsDiscoveredAccount[]>((resolve, reject) =>
        this.fintsService
          .discoveredAccounts(householdId, this.connectionId!)
          .subscribe({ next: resolve, error: reject }),
      );
      this.accountSelections.set(
        accounts.map(a => ({
          ref: a.accountNumber,
          name: a.product
            ? `${a.product} · ${a.accountNumber}`
            : `${a.iban ?? a.accountNumber}`,
          iban: a.iban,
          bic: a.bic,
          selected: true,
        })),
      );
    } catch {
      this.failureMessage.set('Konten konnten nicht geladen werden.');
      this.step.set('failed');
    } finally {
      this.loadingAccounts.set(false);
    }
  }

  protected toggleAccount(index: number, ev: Event): void {
    const checked = (ev.target as HTMLInputElement).checked;
    const list = [...this.accountSelections()];
    list[index] = { ...list[index], selected: checked };
    this.accountSelections.set(list);
  }

  protected async attach(): Promise<void> {
    const householdId = this.householdStore.activeId();
    if (!householdId || !this.connectionId) return;
    this.attaching.set(true);
    this.attachError.set(null);
    try {
      const picks = this.accountSelections()
        .filter(a => a.selected)
        .map(a => ({
          fintsAccountRef: a.ref,
          name: a.name,
          iban: a.iban,
          bic: a.bic,
        }));
      await new Promise<unknown>((resolve, reject) =>
        this.fintsService
          .attachAccounts(householdId, this.connectionId!, picks)
          .subscribe({ next: resolve, error: reject }),
      );
      this.store.reload();
      this.step.set('done');
    } catch (err) {
      this.attachError.set((err as { error?: { detail?: string } })?.error?.detail ?? 'Konnte Konten nicht verknüpfen.');
    } finally {
      this.attaching.set(false);
    }
  }

  protected retry(): void {
    this.step.set('bank');
    this.failureMessage.set(null);
    this.createError.set(null);
    this.tanError.set(null);
    this.attachError.set(null);
  }

  protected cancel(): void {
    this.dismiss();
  }

  protected dismiss(): void {
    this.dialog.close();
    this.store.dismissTanFlow();
  }
}
