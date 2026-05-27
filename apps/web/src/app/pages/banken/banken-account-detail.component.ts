import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TransactionsStore } from '../../core/transactions/transactions.store';
import { TransactionsService } from '../../core/transactions/transactions.service';
import { AccountsService } from '../../core/accounts/accounts.service';
import { FintsStore } from '../../core/fints/fints.store';
import { HouseholdStore } from '../../core/household/household.store';
import { PageHeaderService } from '../../core/page-header/page-header.service';
import { KlarDialogService } from '../../shared/ui/klar-dialog.service';
import { KlarConfirmService } from '../../shared/ui/klar-confirm.service';
import { KlarToastService } from '../../shared/ui/klar-toast.service';
import { TransactionDialogComponent } from '../buchungen/transaction-dialog.component';
import type { BulkVisibilityChange } from '../../shared/transactions/klar-transactions-table.component';
import type {
  FintsAttachedAccount,
  FintsConnectionResponse,
} from '../../core/fints/fints.service';
import type { Transaction } from '../../core/transactions/transactions.store';
import { KlarIconComponent } from '../../shared/icons/klar-icon.component';
import { KlarHeroComponent } from '../../shared/ui/klar-hero.component';
import { KlarTileComponent } from '../../shared/ui/klar-tile.component';
import { KlarEmptyStateComponent } from '../../shared/ui/klar-empty-state.component';
import { KlarButtonComponent } from '../../shared/ui/klar-button.component';
import { KlarTransactionsTableComponent } from '../../shared/transactions/klar-transactions-table.component';

/**
 * Booking overview for a single FinTS-linked Klar Account.
 *
 * Reads parent connection from FintsStore for context (bank name + IBAN)
 * and delegates list rendering / filter UI to <klar-transactions-table>
 * via the store's accountIdFilter mode.
 */
@Component({
  selector: 'klar-banken-account-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    KlarIconComponent,
    KlarHeroComponent,
    KlarTileComponent,
    KlarEmptyStateComponent,
    KlarButtonComponent,
    KlarTransactionsTableComponent,
  ],
  template: `
    <div class="flex flex-col gap-(--s-6) p-(--s-6) pb-16">
      @if (account(); as a) {
        <klar-hero
          eyebrow="Bankkonto"
          [title]="a.name"
          [sub]="connection()?.bankName ?? ''"
        >
          <klar-icon heroEyebrowIcon name="wallet" [size]="11" />
          <div heroActions class="grid grid-cols-2 md:grid-cols-3 gap-3 shrink-0">
            <klar-tile label="Buchungen" [value]="store.sortedItems().length + ''" />
            <klar-tile label="Saldo" [value]="balanceLabel()" />
            <klar-tile label="Letzter Sync" [value]="lastSyncLabel()" />
          </div>
        </klar-hero>

        <div class="flex items-center justify-between gap-3 flex-wrap">
          <div class="flex items-center gap-3 text-[12px] text-(--fg-2) min-w-0">
            <klar-button
              tone="ghost"
              size="sm"
              icon="chevron-left"
              (click)="goBack()"
              ariaLabel="Zurück zur Bankenliste"
            >Zurück</klar-button>
            @if (a.iban) {
              <span class="mono truncate">{{ a.iban }}</span>
            }
          </div>
          <div class="flex items-center gap-2">
            @if (store.loading()) {
              <span class="text-[12px] text-(--fg-2)">Lädt …</span>
            }
            <klar-button
              tone="primary"
              size="sm"
              icon="plus"
              (click)="openCreate()"
            >Buchung</klar-button>
            <klar-button
              tone="ghost"
              size="sm"
              icon="refresh"
              [iconSpin]="fintsStore.syncing() === connectionId()"
              [disabled]="!!fintsStore.syncing()"
              title="Synchronisiert alle Konten dieser Bank"
              (click)="onSync()"
            >
              {{ fintsStore.syncing() === connectionId() ? 'Synchronisiere …' : 'Synchronisieren' }}
            </klar-button>
            <klar-button
              tone="danger"
              size="sm"
              icon="trash"
              [disabled]="purging() || !!fintsStore.syncing() || store.sortedItems().length === 0"
              title="Löscht alle Buchungen dieses Kontos. Der nächste Sync zieht sie wieder."
              (click)="onPurge()"
            >
              {{ purging() ? 'Lösche …' : 'Buchungen löschen' }}
            </klar-button>
          </div>
        </div>

        @if (store.loading() && store.sortedItems().length === 0) {
          <div class="rounded-lg border border-(--line) bg-(--bg-1) px-5 py-10 text-center text-(--fg-2)">
            Lädt Buchungen …
          </div>
        } @else if (store.sortedItems().length === 0) {
          <klar-empty-state
            icon="wallet"
            message="Noch keine Buchungen für dieses Konto. Sobald der nächste Sync läuft, erscheinen sie hier."
          />
        } @else {
          <klar-transactions-table
            [transactions]="store.sortedItems()"
            [lockedFilters]="{ accountId: accountId() }"
            (rowClick)="openEdit($event)"
            (bulkVisibilityChange)="onBulkVisibility($event)"
          />
        }
      } @else {
        <klar-empty-state
          icon="wallet"
          message="Konto nicht gefunden. Möglicherweise wurde es entfernt."
        />
      }
    </div>
  `,
})
export class BankenAccountDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly pageHeader = inject(PageHeaderService);
  private readonly dialog = inject(KlarDialogService);
  private readonly confirm = inject(KlarConfirmService);
  private readonly transactionsService = inject(TransactionsService);
  private readonly accountsService = inject(AccountsService);
  private readonly householdStore = inject(HouseholdStore);
  private readonly toast = inject(KlarToastService);
  protected readonly store = inject(TransactionsStore);
  protected readonly fintsStore = inject(FintsStore);

  protected readonly connectionId = signal('');
  protected readonly accountId = signal('');
  protected readonly purging = signal(false);

  protected readonly connection = computed<FintsConnectionResponse | undefined>(() => {
    const id = this.connectionId();
    return this.fintsStore.connections()?.find(c => c.id === id);
  });

  protected readonly account = computed<FintsAttachedAccount | undefined>(() => {
    const id = this.accountId();
    return this.connection()?.accounts.find(a => a.id === id);
  });

  /**
   * Preferred: HKSAL-reported `lastKnownBalanceCents` (authoritative).
   * Fallback: cumulative sum of the loaded transactions — useful while
   * HKSAL fetching isn't wired yet, since it gives the user *something*
   * meaningful instead of a placeholder dash.
   */
  protected readonly balanceLabel = computed(() => {
    const cents = this.account()?.lastKnownBalanceCents;
    if (cents !== null && cents !== undefined) return this.formatCents(cents);
    const txs = this.store.sortedItems();
    if (txs.length === 0) return '—';
    return this.formatCents(txs.reduce((s, t) => s + t.amountCents, 0));
  });

  protected readonly lastSyncLabel = computed(() => {
    const iso = this.connection()?.lastSyncAt;
    if (!iso) return '—';
    const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (minutes < 1) return 'gerade eben';
    if (minutes < 60) return `vor ${minutes} Min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `vor ${hours} Std`;
    return `vor ${Math.floor(hours / 24)} Tg`;
  });

  ngOnInit(): void {
    const params = this.route.snapshot.paramMap;
    this.connectionId.set(params.get('connectionId') ?? '');
    this.accountId.set(params.get('accountId') ?? '');
    this.pageHeader.set({
      title: 'Bankkonto',
      subtitle: this.connection()?.bankName ?? 'FinTS',
      showUserSwitch: true,
    });
    if (!this.fintsStore.connections()) {
      this.fintsStore.reload();
    }
    this.store.setAccountIdFilter(this.accountId());
  }

  openCreate(): void {
    this.dialog.open({
      title: 'Buchung anlegen',
      component: TransactionDialogComponent,
      inputs: { tx: null, presetAccountId: this.accountId() },
      width: 'md',
    });
  }

  openEdit(tx: Transaction): void {
    this.dialog.open({
      title: 'Buchung bearbeiten',
      component: TransactionDialogComponent,
      inputs: { tx },
      width: 'md',
    });
  }

  async onBulkVisibility(change: BulkVisibilityChange): Promise<void> {
    const householdId = this.householdStore.activeId();
    if (!householdId) return;
    try {
      const { count } = await this.transactionsService.bulkSetVisibility(
        householdId,
        change.ids,
        change.visibility,
      );
      this.store.reload();
      const label = change.visibility === 'PRIVATE' ? 'privat' : 'geteilt';
      this.toast.success(`${count} ${count === 1 ? 'Buchung' : 'Buchungen'} ${label} gesetzt`);
    } catch {
      this.toast.error('Sichtbarkeit konnte nicht geändert werden');
    }
  }

  goBack(): void {
    void this.router.navigate(['/app/banken']);
  }

  async onPurge(): Promise<void> {
    const householdId = this.householdStore.activeId();
    const accountId = this.accountId();
    if (!householdId || !accountId) return;
    const count = this.store.sortedItems().length;
    const ok = await this.confirm.ask({
      title: 'Alle Buchungen löschen?',
      message: `${count} Buchung${count === 1 ? '' : 'en'} dieses Kontos werden entfernt.`,
      detail:
        'Daueraufträge aus FinTS-Erkennung werden ebenfalls zurückgesetzt. Der nächste Sync importiert die Buchungen frisch — Reste aus alten Versionen sind danach weg.',
      confirmLabel: 'Löschen',
      cancelLabel: 'Abbrechen',
      tone: 'danger',
    });
    if (!ok) return;
    this.purging.set(true);
    try {
      const result = await this.accountsService.purgeTransactions(householdId, accountId);
      this.store.reload();
      this.fintsStore.reload();
      this.toast.success(
        `${result.deletedTransactions} Buchung${result.deletedTransactions === 1 ? '' : 'en'} gelöscht`,
      );
    } catch {
      this.toast.error('Buchungen konnten nicht gelöscht werden');
    } finally {
      this.purging.set(false);
    }
  }

  async onSync(): Promise<void> {
    const id = this.connectionId();
    if (!id) return;
    try {
      await this.fintsStore.triggerSync(id);
      this.store.reload();
    } catch {
      // toast surfaced by HTTP interceptor
    }
  }

  private formatCents(cents: number): string {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(cents / 100);
  }
}
