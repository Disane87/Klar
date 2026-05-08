import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HouseholdStore } from '../../core/household/household.store';
import { FintsStore } from '../../core/fints/fints.store';
import {
  FintsService,
  type FintsBankLookupResult,
  type FintsCreateConnectionResponse,
  type FintsDiscoveredAccount,
  type FintsSyncRunWithChallenge,
  type FintsTanChallenge,
} from '../../core/fints/fints.service';
import { KlarInputComponent } from '../../shared/ui/klar-input.component';
import { KlarButtonComponent } from '../../shared/ui/klar-button.component';
import { KlarIconComponent } from '../../shared/icons/klar-icon.component';
import { KlarDialogService } from '../../shared/ui/klar-dialog.service';

type WizardStep = 'bank' | 'credentials' | 'tan' | 'accounts' | 'done' | 'failed';

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
  imports: [FormsModule, KlarInputComponent, KlarButtonComponent, KlarIconComponent],
  template: `
    <div class="flex flex-col gap-(--s-5)">
      <!-- Stepper -->
      <ol class="flex items-center gap-2 text-[10px] uppercase tracking-widest text-(--fg-3)">
        <li [class.text-]="step() === 'bank'"
            [style.color]="stepColor('bank')">1 Bank</li>
        <li class="text-(--fg-3)">·</li>
        <li [style.color]="stepColor('credentials')">2 Login</li>
        <li class="text-(--fg-3)">·</li>
        <li [style.color]="stepColor('tan')">3 TAN</li>
        <li class="text-(--fg-3)">·</li>
        <li [style.color]="stepColor('accounts')">4 Konten</li>
      </ol>

      @if (step() === 'bank') {
        <section class="flex flex-col gap-3">
          <p class="text-[13px] text-(--fg-2)">
            Tippe deine Bankleitzahl ein. Klar findet die FinTS-Endpunkt-Adresse automatisch.
          </p>
          <klar-input
            label="BLZ"
            type="text"
            placeholder="z. B. 37050198"
            iconName="search"
            [ngModel]="blz()"
            (ngModelChange)="onBlzChange($event)"
            hint="8 Ziffern · Sparkasse, VR-Banken, Direktbanken werden unterstützt"
          />
          @if (lookupError()) {
            <div class="text-[12px] text-(--danger)">{{ lookupError() }}</div>
          }
          @if (lookupResult()?.found) {
            <div class="rounded-md border border-(--line-soft) bg-(--bg-2) px-4 py-3 flex flex-col gap-1">
              <div class="text-[14px] font-medium">{{ resolvedName() }}</div>
              @if (resolvedCity()) {
                <div class="text-[11px] text-(--fg-2)">{{ resolvedCity() }}</div>
              }
              @if (!resolvedFintsCapable()) {
                <div class="text-[12px] text-(--accent) mt-1">
                  Diese Bank meldet keinen FinTS-PIN/TAN-Zugang. Du kannst die URL gleich manuell
                  eintragen.
                </div>
              }
            </div>
          }
          <klar-input
            label="FinTS-Server (URL)"
            type="text"
            placeholder="https://…/fints"
            iconName="link"
            [ngModel]="serverUrl()"
            (ngModelChange)="serverUrl.set($event)"
            hint="Wird vom Lookup vorausgefüllt — nur ändern, wenn deine Bank in der Liste fehlt."
          />
          <klar-input
            label="Anzeigename"
            type="text"
            placeholder="Bankname"
            [ngModel]="bankName()"
            (ngModelChange)="bankName.set($event)"
          />
          <div class="flex justify-end gap-2 pt-2">
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
export class FintsSetupWizardComponent {
  protected readonly store = inject(FintsStore);
  private readonly fintsService = inject(FintsService);
  private readonly householdStore = inject(HouseholdStore);
  private readonly dialog = inject(KlarDialogService);

  protected readonly step = signal<WizardStep>('bank');

  // Step 1: bank
  protected readonly blz = signal('');
  protected readonly bankName = signal('');
  protected readonly serverUrl = signal('');
  protected readonly lookupResult = signal<FintsBankLookupResult | null>(null);
  protected readonly lookupError = signal<string | null>(null);
  private lookupTimer: ReturnType<typeof setTimeout> | null = null;

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

  protected readonly canSubmitCredentials = computed(
    () => this.loginName().trim().length > 0 && this.pin().length > 0,
  );

  protected readonly canAttach = computed(
    () => this.accountSelections().some(a => a.selected),
  );

  protected readonly resolvedName = computed(() => {
    const r = this.lookupResult();
    return r?.found ? r.record.name : '';
  });

  protected readonly resolvedCity = computed(() => {
    const r = this.lookupResult();
    return r?.found ? r.record.city ?? '' : '';
  });

  protected readonly resolvedFintsCapable = computed(() => {
    const r = this.lookupResult();
    return r?.found ? r.fintsCapable : false;
  });

  protected readonly tanImageSrc = computed(() => {
    const c = this.tanChallenge();
    if (!c?.mediaBase64) return '';
    const mime = c.mediaMimeType ?? 'image/png';
    return `data:${mime};base64,${c.mediaBase64}`;
  });

  protected stepColor(s: WizardStep): string {
    return this.step() === s ? 'var(--accent)' : 'var(--fg-3)';
  }

  protected onBlzChange(value: string): void {
    this.blz.set(value);
    this.lookupError.set(null);
    if (this.lookupTimer) clearTimeout(this.lookupTimer);
    if (!/^[0-9]{8}$/.test(value)) return;
    this.lookupTimer = setTimeout(() => this.runLookup(value), 250);
  }

  private async runLookup(blz: string): Promise<void> {
    const householdId = this.householdStore.activeId();
    if (!householdId) return;
    try {
      const result = await new Promise<FintsBankLookupResult>((resolve, reject) =>
        this.fintsService.lookupBank(householdId, blz).subscribe({ next: resolve, error: reject }),
      );
      this.lookupResult.set(result);
      if (result.found) {
        this.bankName.set(result.record.name);
        this.serverUrl.set(result.record.pinTanUrl ?? '');
      }
    } catch {
      this.lookupError.set('Bank-Lookup fehlgeschlagen — du kannst die URL manuell eintragen.');
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
