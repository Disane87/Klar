import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { HouseholdStore } from '../../core/household/household.store';
import { FintsStore } from '../../core/fints/fints.store';
import { PageHeaderService } from '../../core/page-header/page-header.service';
import type { Transaction } from '../../core/transactions/transactions.store';
import type {
  FintsAttachedAccount,
  FintsConnectionResponse,
} from '../../core/fints/fints.service';
import { KlarIconComponent } from '../../shared/icons/klar-icon.component';
import { KlarHeroComponent } from '../../shared/ui/klar-hero.component';
import { KlarMetricTileComponent } from '../../shared/ui/klar-metric-tile.component';
import { KlarEmptyStateComponent } from '../../shared/ui/klar-empty-state.component';
import { KlarBadgeComponent } from '../../shared/ui/klar-badge.component';
import { KlarButtonComponent } from '../../shared/ui/klar-button.component';
import { KlarInputComponent } from '../../shared/ui/klar-input.component';
import {
  KlarToggleGroupComponent,
  type KlarToggleOption,
} from '../../shared/ui/klar-toggle-group.component';

type AmountFilter = 'all' | 'income' | 'expense';
type SourceFilter = 'all' | 'fints' | 'manual' | 'csv';

/**
 * Booking overview for a single FinTS-linked Klar Account.
 *
 * Lists every Transaction whose accountId matches the URL param. Reads
 * the parent connection from FintsStore so the user sees full context
 * (bank name + account name + IBAN) without an extra round-trip.
 */
@Component({
  selector: 'klar-banken-account-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    FormsModule,
    KlarIconComponent,
    KlarHeroComponent,
    KlarMetricTileComponent,
    KlarEmptyStateComponent,
    KlarBadgeComponent,
    KlarButtonComponent,
    KlarInputComponent,
    KlarToggleGroupComponent,
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
            <klar-metric-tile label="Buchungen" [value]="transactions().length + ''" />
            <klar-metric-tile
              label="Saldo"
              [value]="balanceLabel()"
            />
            <klar-metric-tile
              label="Letzter Sync"
              [value]="lastSyncLabel()"
            />
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
            @if (loading()) {
              <span class="text-[12px] text-(--fg-2)">Lädt …</span>
            }
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
          </div>
        </div>

        @if (loading() && transactions().length === 0) {
          <div class="rounded-lg border border-(--line) bg-(--bg-1) px-5 py-10 text-center text-(--fg-2)">
            Lädt Buchungen …
          </div>
        } @else if (transactions().length === 0) {
          <klar-empty-state
            icon="wallet"
            message="Noch keine Buchungen für dieses Konto. Sobald der nächste Sync läuft, erscheinen sie hier."
          />
        } @else {
          <!-- Filter bar: full-text search + amount-direction + source. All
               filters are client-side over the already-loaded transactions
               so they're instant; the filtered set re-feeds monthlyGroups. -->
          <div class="flex flex-col md:flex-row md:items-end gap-2">
            <div class="flex-1 min-w-0">
              <klar-input
                type="search"
                placeholder="Beschreibung, Empfänger oder Verwendungszweck …"
                iconName="search"
                [ngModel]="searchQuery()"
                (ngModelChange)="searchQuery.set($event)"
              />
            </div>
            <klar-toggle-group
              [options]="amountFilterOptions"
              [value]="amountFilter()"
              (valueChange)="amountFilter.set($event || 'all')"
            />
            <klar-toggle-group
              [options]="sourceFilterOptions"
              [value]="sourceFilter()"
              (valueChange)="sourceFilter.set($event || 'all')"
            />
            @if (isFiltered()) {
              <klar-button tone="ghost" size="sm" icon="x" (click)="clearFilters()">
                Filter zurücksetzen
              </klar-button>
            }
          </div>
          @if (filteredTransactions().length === 0) {
            <klar-empty-state
              icon="search"
              message="Keine Buchungen passen zum Filter."
            />
          } @else {
          <!-- Scrollable, month-grouped list. Backend returns descending by
               date, so the Map's insertion order is newest-first. Sticky
               month headers stay in view while scrolling within each group. -->
          <div
            class="rounded-md border border-(--line-soft) bg-(--bg-1) overflow-hidden flex flex-col"
          >
            <div
              class="overflow-y-auto"
              style="max-height: clamp(360px, calc(100dvh - 360px), 720px);"
            >
              @for (group of monthlyGroups(); track group.key) {
                <div
                  class="sticky top-0 z-10 px-4 py-2 border-b border-(--line-soft) bg-(--bg-2) flex items-center justify-between gap-3"
                >
                  <span class="text-[10px] uppercase tracking-widest text-muted-foreground">
                    {{ group.label }}
                  </span>
                  <span class="text-[11px] mono tabular-nums text-(--fg-2)">
                    {{ group.itemsCount }} · <span [class.text-success]="group.totalCents > 0" [class.text-danger]="group.totalCents < 0">{{ group.totalLabel }}</span>
                  </span>
                </div>
                <ul>
                  @for (t of group.items; track t.id) {
                    <li
                      class="grid gap-3 px-4 py-3 border-b border-(--line-soft) hover:bg-(--bg-2) transition-colors"
                      style="grid-template-columns: 60px 1fr auto; align-items: center;"
                    >
                      <span class="text-[11px] text-(--fg-2) mono tabular-nums">
                        {{ t.date | date:'dd.MM.' }}
                      </span>
                      <div class="min-w-0">
                        <div class="text-[13px] truncate text-(--fg)">
                          {{ t.description || '—' }}
                        </div>
                        @if (t.counterparty) {
                          <div class="text-[11px] text-(--fg-2) truncate">{{ t.counterparty }}</div>
                        }
                      </div>
                      <div class="flex items-center gap-2 shrink-0">
                        @if (t.source === 'fints') {
                          <klar-badge tone="zinc">FinTS</klar-badge>
                        }
                        <span
                          class="text-[13px] mono tabular-nums font-medium"
                          [class.text-success]="t.amountCents > 0"
                          [class.text-danger]="t.amountCents < 0"
                        >
                          {{ formatCents(t.amountCents) }}
                        </span>
                      </div>
                    </li>
                  }
                </ul>
              }
            </div>
          </div>
          <div class="text-[11px] text-(--fg-3) text-center mono">
            @if (isFiltered()) {
              {{ filteredTransactions().length }} von {{ transactions().length }} Buchung{{ transactions().length === 1 ? '' : 'en' }}
            } @else {
              {{ transactions().length }} Buchung{{ transactions().length === 1 ? '' : 'en' }}
            }
            · {{ monthlyGroups().length }} Monat{{ monthlyGroups().length === 1 ? '' : 'e' }}
          </div>
          }
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
  private readonly http = inject(HttpClient);
  private readonly householdStore = inject(HouseholdStore);
  protected readonly fintsStore = inject(FintsStore);
  private readonly pageHeader = inject(PageHeaderService);

  protected readonly connectionId = signal('');
  protected readonly accountId = signal('');
  protected readonly transactions = signal<Transaction[]>([]);
  protected readonly loading = signal(true);

  // ── Filters ──────────────────────────────────────────────────────────────
  protected readonly searchQuery = signal('');
  protected readonly amountFilter = signal<AmountFilter>('all');
  protected readonly sourceFilter = signal<SourceFilter>('all');

  protected readonly amountFilterOptions: readonly KlarToggleOption<AmountFilter>[] = [
    { value: 'all',     label: 'Alle' },
    { value: 'income',  label: 'Eingang' },
    { value: 'expense', label: 'Ausgang' },
  ];

  protected readonly sourceFilterOptions: readonly KlarToggleOption<SourceFilter>[] = [
    { value: 'all',    label: 'Alle Quellen' },
    { value: 'fints',  label: 'FinTS' },
    { value: 'manual', label: 'Manuell' },
    { value: 'csv',    label: 'CSV' },
  ];

  protected readonly isFiltered = computed(
    () =>
      this.searchQuery().trim().length > 0 ||
      this.amountFilter() !== 'all' ||
      this.sourceFilter() !== 'all',
  );

  /**
   * All client-side filters combined into one pass over the transaction
   * list. Search matches against description AND counterparty (case-fold);
   * amount filter splits by sign; source filter checks the FinTS / manual
   * / csv badge. Computed so re-runs are cheap and only fire when the
   * inputs change.
   */
  protected readonly filteredTransactions = computed<Transaction[]>(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const amount = this.amountFilter();
    const source = this.sourceFilter();
    return this.transactions().filter(t => {
      if (q) {
        const haystack = `${t.description ?? ''} ${t.counterparty ?? ''}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (amount === 'income' && t.amountCents <= 0) return false;
      if (amount === 'expense' && t.amountCents >= 0) return false;
      if (source !== 'all' && (t.source ?? 'manual') !== source) return false;
      return true;
    });
  });

  protected clearFilters(): void {
    this.searchQuery.set('');
    this.amountFilter.set('all');
    this.sourceFilter.set('all');
  }

  protected readonly connection = computed<FintsConnectionResponse | undefined>(() => {
    const id = this.connectionId();
    return this.fintsStore.connections()?.find(c => c.id === id);
  });

  protected readonly account = computed<FintsAttachedAccount | undefined>(() => {
    const accId = this.accountId();
    return this.connection()?.accounts.find(a => a.id === accId);
  });

  /**
   * Bookings grouped by `YYYY-MM`, newest month first. Within a month the
   * order is descending by date (newest at top). Each group carries its
   * own monthly sum so the user sees the per-month net flow without
   * scrolling to the end. The Map's insertion order preserves the input
   * sort, which we re-establish defensively in case the backend ever
   * returns them ascending.
   */
  protected readonly monthlyGroups = computed(() => {
    const sorted = [...this.filteredTransactions()].sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return b.createdAt.localeCompare(a.createdAt);
    });
    const groups = new Map<string, Transaction[]>();
    for (const t of sorted) {
      const key = t.date.slice(0, 7);
      const arr = groups.get(key) ?? [];
      arr.push(t);
      groups.set(key, arr);
    }
    return Array.from(groups.entries()).map(([key, items]) => {
      const totalCents = items.reduce((s, t) => s + t.amountCents, 0);
      return {
        key,
        label: this.formatMonthLabel(key),
        items,
        itemsCount: items.length,
        totalCents,
        totalLabel: this.formatCents(totalCents),
      };
    });
  });

  private formatMonthLabel(yearMonth: string): string {
    const [y, m] = yearMonth.split('-').map(Number);
    if (!y || !m) return yearMonth;
    const date = new Date(Date.UTC(y, m - 1, 1));
    return new Intl.DateTimeFormat('de-DE', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(date);
  }

  /**
   * Preferred: HKSAL-reported `lastKnownBalanceCents` (authoritative).
   * Fallback: cumulative sum of all imported bookings — useful while
   * HKSAL fetching isn't wired yet, since it gives the user *something*
   * meaningful instead of a placeholder dash.
   */
  protected readonly balanceLabel = computed(() => {
    const cents = this.account()?.lastKnownBalanceCents;
    if (cents !== null && cents !== undefined) return this.formatCents(cents);
    const txs = this.transactions();
    if (txs.length === 0) return '—';
    const sum = txs.reduce((s, t) => s + t.amountCents, 0);
    return this.formatCents(sum);
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
    void this.loadTransactions();
  }

  private async loadTransactions(): Promise<void> {
    const householdId = this.householdStore.activeId();
    const accountId = this.accountId();
    if (!householdId || !accountId) {
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    try {
      const items = await firstValueFrom(
        this.http.get<Transaction[]>(
          `/api/v1/households/${householdId}/transactions`,
          { params: { accountId } },
        ),
      );
      this.transactions.set(items);
    } catch {
      this.transactions.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  protected goBack(): void {
    void this.router.navigate(['/app/banken']);
  }

  /**
   * Triggers a sync of the parent FinTS connection (FinTS dialogs are
   * connection-scoped — there's no per-account fetch). After it returns,
   * we reload bookings so newly imported transactions show up immediately.
   */
  protected async onSync(): Promise<void> {
    const connId = this.connectionId();
    if (!connId) return;
    try {
      await this.fintsStore.triggerSync(connId);
      await this.loadTransactions();
    } catch {
      // HTTP interceptor surfaces the toast.
    }
  }

  protected formatCents(cents: number): string {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(cents / 100);
  }
}
