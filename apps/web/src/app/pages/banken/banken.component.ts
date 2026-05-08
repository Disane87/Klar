import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { PageHeaderService } from '../../core/page-header/page-header.service';
import { FintsStore } from '../../core/fints/fints.store';
import type {
  FintsConnectionResponse,
  FintsConnectionStatus,
} from '../../core/fints/fints.service';
import { KlarButtonComponent } from '../../shared/ui/klar-button.component';
import { KlarBadgeComponent } from '../../shared/ui/klar-badge.component';
import { KlarTileComponent } from '../../shared/ui/klar-tile.component';
import { KlarEmptyStateComponent } from '../../shared/ui/klar-empty-state.component';
import { KlarHeroComponent } from '../../shared/ui/klar-hero.component';
import { KlarIconComponent } from '../../shared/icons/klar-icon.component';
import { KlarConfirmService } from '../../shared/ui/klar-confirm.service';
import { KlarDialogService } from '../../shared/ui/klar-dialog.service';
import { FintsSetupWizardComponent } from './fints-setup-wizard.component';

type BadgeToneShort = 'emerald' | 'amber' | 'rose' | 'zinc';

interface StatusVariant {
  label: string;
  tone: BadgeToneShort;
}

const STATUS_VARIANTS: Record<FintsConnectionStatus, StatusVariant> = {
  ACTIVE:           { label: 'Aktiv',          tone: 'emerald' },
  SETUP:            { label: 'Einrichtung',    tone: 'zinc'    },
  TAN_REQUIRED:     { label: 'TAN erforderlich', tone: 'amber' },
  REAUTH_REQUIRED:  { label: 'Re-Auth nötig',  tone: 'amber'   },
  DISABLED:         { label: 'Deaktiviert',    tone: 'zinc'    },
  ERROR:            { label: 'Fehler',         tone: 'rose'    },
};

@Component({
  selector: 'klar-banken-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    KlarButtonComponent,
    KlarBadgeComponent,
    KlarTileComponent,
    KlarEmptyStateComponent,
    KlarHeroComponent,
    KlarIconComponent,
  ],
  template: `
    <div class="flex flex-col gap-(--s-6) p-(--s-6) pb-16">
      <klar-hero
        eyebrow="FinTS-Bankzugriff"
        [title]="heroTitle()"
        sub="Verbinde dein Online-Banking, damit Buchungen automatisch ankommen — ohne CSV-Export. Klar speichert deinen PIN nur verschlüsselt und nie auf einem fremden Server."
      >
        <klar-icon heroEyebrowIcon name="wallet" [size]="11" />
        <div heroActions class="grid grid-cols-2 md:grid-cols-4 gap-3 shrink-0">
          <klar-tile label="Aktive Verbindungen" [value]="activeCount() + ''" />
          <klar-tile label="Saldo gesamt" [value]="totalBalanceLabel()" />
          <klar-tile label="Letzter Sync" [value]="lastSyncLabel()" />
          <klar-tile
            label="Aufmerksamkeit"
            [value]="reauthCount() + ''"
            [tone]="reauthCount() > 0 ? 'warn' : 'neutral'"
          />
        </div>
      </klar-hero>

      @if (store.hasReauthRequired()) {
        <section
          class="flex items-start gap-3 px-4 py-3 rounded-md border border-(--accent)/30 bg-(--accent-soft)"
        >
          <klar-icon name="shield" [size]="14" class="text-(--accent) mt-0.5" />
          <div class="flex-1 min-w-0">
            <div class="text-[12px] font-medium text-(--accent)">
              Bank-Verbindung erneuern
            </div>
            <div class="text-[13px] text-(--fg)">
              Eine deiner Verbindungen verlangt eine frische TAN-Bestätigung (PSD2 SCA).
            </div>
          </div>
        </section>
      }

      <!-- Action row -->
      <div class="flex items-center justify-between gap-3 flex-wrap">
        <span class="text-[12px] text-(--fg-2)">
          @if (store.connections()?.length) {
            {{ store.connections()?.length }} Verbindung{{ store.connections()?.length === 1 ? '' : 'en' }}
          } @else {
            Noch keine Verbindungen
          }
        </span>
        <div class="flex items-center gap-2">
          @if ((store.connections()?.length ?? 0) > 0) {
            <klar-button
              tone="ghost"
              size="sm"
              icon="refresh"
              [iconSpin]="store.syncingAll()"
              [disabled]="store.syncingAll() || !!store.syncing()"
              (click)="onSyncAll()"
            >
              {{ store.syncingAll() ? 'Synchronisiere …' : 'Alle synchronisieren' }}
            </klar-button>
          }
          <klar-button tone="primary" size="sm" icon="plus" (click)="openSetupWizard()">
            Bank verbinden
          </klar-button>
        </div>
      </div>

      <!-- List or empty -->
      @if (store.loading() && !store.connections()) {
        <div class="rounded-lg border border-(--line) bg-(--bg-1) px-5 py-10 text-center text-(--fg-2)">
          Lädt …
        </div>
      } @else if (!store.connections() || store.connections()!.length === 0) {
        <klar-empty-state
          icon="wallet"
          [message]="emptyMessage"
          ctaLabel="Bank verbinden"
          (ctaClick)="openSetupWizard()"
        />
      } @else {
        <ul class="flex flex-col gap-2">
          @for (c of store.connections(); track c.id) {
            <li
              class="rounded-md border border-(--line-soft) bg-(--bg-1) overflow-hidden transition-colors"
            >
              <!-- Header: clicking it toggles the account list. The action
                   buttons stop event propagation so they don't trigger
                   collapse. -->
              <div
                class="cat-bar px-4 py-3 grid gap-3 cursor-pointer hover:bg-(--bg-2)"
                style="grid-template-columns: auto 1fr auto auto; align-items: center;"
                [style.--cat-color]="connectionTone(c)"
                (click)="toggleExpanded(c.id)"
                role="button"
                [attr.aria-expanded]="isExpanded(c.id)"
                [attr.aria-label]="(isExpanded(c.id) ? 'Konten ausblenden' : 'Konten einblenden') + ' für ' + c.bankName"
              >
                <klar-icon
                  name="chevron-down"
                  [size]="14"
                  class="shrink-0 text-(--fg-2) transition-transform duration-200"
                  [class.-rotate-90]="!isExpanded(c.id)"
                />
                <div class="min-w-0">
                  <div class="text-[14px] font-medium truncate text-(--fg)">{{ c.bankName }}</div>
                  <div class="text-[11px] text-(--fg-2) truncate mono">
                    BLZ {{ c.blz }} · {{ c.loginName }}
                    @if (c.accounts.length) {
                      · {{ c.accounts.length }} {{ c.accounts.length === 1 ? 'Konto' : 'Konten' }}
                    }
                  </div>
                </div>
                <div class="hidden md:flex flex-col items-end gap-1 min-w-40">
                  <div class="flex items-center gap-2">
                    <span class="text-[12px] mono tabular-nums text-(--fg)">
                      {{ connectionBalanceLabel(c) }}
                    </span>
                    <klar-badge [tone]="statusTone(c.status)">{{ statusLabel(c.status) }}</klar-badge>
                  </div>
                  @if (c.lastSyncAt) {
                    <span class="text-[10px] text-(--fg-3) mono">
                      ↻ {{ c.lastSyncAt | date:'dd.MM. HH:mm' }}
                    </span>
                  }
                </div>
                <div class="flex items-center gap-1 shrink-0">
                  <klar-button
                    tone="ghost"
                    size="sm"
                    icon="refresh"
                    [iconSpin]="store.syncing() === c.id || store.syncingAll()"
                    [disabled]="!!store.syncing() || store.syncingAll()"
                    [aria-label]="'Jetzt synchronisieren'"
                    (click)="$event.stopPropagation(); onSync(c.id)"
                  />
                  <klar-button
                    tone="ghost"
                    size="sm"
                    icon="x"
                    [disabled]="store.deleting() === c.id"
                    [aria-label]="'Verbindung löschen'"
                    (click)="$event.stopPropagation(); onDelete(c)"
                  />
                </div>
              </div>
              @if (c.status === 'REAUTH_REQUIRED') {
                <div class="px-4 py-2 border-t border-(--line-soft) bg-(--accent-soft) text-[12px] text-(--accent)">
                  Diese Verbindung verlangt eine frische TAN-Bestätigung.
                </div>
              }
              @if (isExpanded(c.id)) {
                @if (c.accounts.length === 0) {
                  <div class="px-5 py-4 border-t border-(--line-soft) text-[12px] text-(--fg-2)">
                    Keine Konten verknüpft.
                  </div>
                } @else {
                  <ul class="border-t border-(--line-soft) bg-(--bg)">
                    @for (a of c.accounts; track a.id) {
                      <li class="flex items-center gap-1 hover:bg-(--bg-2) active:bg-(--bg-2) transition-colors">
                        <button
                          type="button"
                          class="flex-1 flex items-center gap-3 px-5 py-3 text-left min-w-0"
                          (click)="openAccount(c.id, a.id)"
                          [attr.aria-label]="'Buchungen für ' + a.name + ' öffnen'"
                        >
                          <klar-icon name="wallet" [size]="14" class="shrink-0 text-(--fg-2)" />
                          <div class="flex-1 min-w-0">
                            <div class="text-[13px] font-medium truncate text-(--fg)">{{ a.name }}</div>
                            @if (a.iban) {
                              <div class="text-[11px] text-(--fg-2) truncate mono">{{ a.iban }}</div>
                            }
                          </div>
                          <div class="hidden sm:flex flex-col items-end gap-0.5 shrink-0">
                            <span class="text-[12px] mono tabular-nums text-(--fg)">
                              {{ a.lastKnownBalanceCents !== null ? formatCents(a.lastKnownBalanceCents) : '—' }}
                            </span>
                            @if (c.lastSyncAt) {
                              <span class="text-[10px] text-(--fg-3) mono">
                                ↻ {{ c.lastSyncAt | date:'dd.MM. HH:mm' }}
                              </span>
                            }
                          </div>
                          <klar-icon name="chevron-right" [size]="12" class="shrink-0 text-(--fg-3)" />
                        </button>
                        <klar-button
                          tone="ghost"
                          size="sm"
                          icon="refresh"
                          class="pr-3 shrink-0"
                          [iconSpin]="store.syncing() === c.id || store.syncingAll()"
                          [disabled]="!!store.syncing() || store.syncingAll()"
                          [aria-label]="'Konto ' + a.name + ' synchronisieren (synchronisiert alle Konten dieser Bank)'"
                          title="Synchronisiert alle Konten dieser Bank"
                          (click)="onSync(c.id)"
                        />
                      </li>
                    }
                  </ul>
                }
              }
            </li>
          }
        </ul>
      }
    </div>
  `,
})
export class BankenPageComponent implements OnInit {
  protected readonly store = inject(FintsStore);
  private readonly pageHeader = inject(PageHeaderService);
  private readonly confirm = inject(KlarConfirmService);
  private readonly dialog = inject(KlarDialogService);
  private readonly router = inject(Router);

  /** Set of connectionIds whose account list is expanded. */
  protected readonly expanded = signal<ReadonlySet<string>>(new Set());

  protected isExpanded(id: string): boolean {
    return this.expanded().has(id);
  }

  protected toggleExpanded(id: string): void {
    const next = new Set(this.expanded());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.expanded.set(next);
  }

  protected openAccount(connectionId: string, accountId: string): void {
    void this.router.navigate(['/app/banken', connectionId, accountId]);
  }

  /**
   * Per-connection saldo: sum of every linked account's
   * `lastKnownBalanceCents`. Returns `—` when no account has reported a
   * balance yet (HKSAL hasn't run) so we don't render misleading 0,00 €.
   */
  protected connectionBalanceLabel(c: FintsConnectionResponse): string {
    let total = 0;
    let any = false;
    for (const a of c.accounts) {
      if (a.lastKnownBalanceCents !== null && a.lastKnownBalanceCents !== undefined) {
        total += a.lastKnownBalanceCents;
        any = true;
      }
    }
    if (!any) return '—';
    return this.formatCents(total);
  }

  protected formatCents(cents: number): string {
    const euros = cents / 100;
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(euros);
  }

  protected readonly activeCount = computed(
    () => this.store.connections()?.filter(c => c.status === 'ACTIVE').length ?? 0,
  );

  protected readonly reauthCount = computed(
    () => this.store.connections()?.filter(c => c.status === 'REAUTH_REQUIRED').length ?? 0,
  );

  /**
   * Sum of `lastKnownBalanceCents` across every linked account of every
   * connection. Skipped when no connection has reported a balance yet
   * (HKSAL hasn't run on any of them); we render `—` instead of misleading
   * "0,00 €". Once we wire up HKSAL fetching, this lights up automatically.
   */
  protected readonly totalBalanceLabel = computed(() => {
    const list = this.store.connections() ?? [];
    let total = 0;
    let any = false;
    for (const c of list) {
      for (const a of c.accounts) {
        if (a.lastKnownBalanceCents !== null && a.lastKnownBalanceCents !== undefined) {
          total += a.lastKnownBalanceCents;
          any = true;
        }
      }
    }
    if (!any) return '—';
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(total / 100);
  });

  protected readonly lastSyncLabel = computed(() => {
    const list = this.store.connections() ?? [];
    const dates = list
      .map(c => c.lastSyncAt)
      .filter((d): d is string => !!d)
      .sort();
    if (dates.length === 0) return '—';
    const latest = new Date(dates[dates.length - 1]);
    const minutes = Math.floor((Date.now() - latest.getTime()) / 60000);
    if (minutes < 1) return 'gerade eben';
    if (minutes < 60) return `vor ${minutes} Min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `vor ${hours} Std`;
    const days = Math.floor(hours / 24);
    return `vor ${days} Tg`;
  });

  protected readonly emptyMessage =
    'Noch keine Bank verbunden. Klick auf „Bank verbinden", um die erste Verbindung über FinTS einzurichten.';

  protected readonly heroTitle = computed(() => {
    const n = this.store.connections()?.length ?? 0;
    if (n === 0) return 'Noch keine Bank verbunden';
    if (n === 1) return '1 Bank synchronisiert mit Klar';
    return `${n} Banken synchronisieren mit Klar`;
  });

  ngOnInit(): void {
    this.pageHeader.set({
      title:    'Banken',
      subtitle: 'FinTS-Bankzugriff',
      showUserSwitch: true,
    });
  }

  protected openSetupWizard(): void {
    this.dialog.open({
      title: 'Bank verbinden',
      component: FintsSetupWizardComponent,
      width: 'lg',
      // Default height='auto' — dialog grows with content. The wizard
      // body itself caps inner-scroll, so a long account list won't
      // blow the viewport.
      disableBackdropClose: true,
    });
  }

  protected async onSync(id: string): Promise<void> {
    try {
      await this.store.triggerSync(id);
    } catch (err) {
      // Error toast handled by HTTP interceptor (RFC 7807)
      void err;
    }
  }

  protected async onSyncAll(): Promise<void> {
    try {
      await this.store.triggerSyncAll();
    } catch (err) {
      void err;
    }
  }

  protected async onDelete(c: FintsConnectionResponse): Promise<void> {
    const ok = await this.confirm.ask({
      title:        'Verbindung löschen?',
      message:      `Möchtest du die Verbindung zu „${c.bankName}" wirklich entfernen?`,
      detail:       'Vorhandene Buchungen bleiben in Klar erhalten. Du kannst die Verbindung später wieder neu einrichten.',
      confirmLabel: 'Löschen',
      cancelLabel:  'Abbrechen',
      tone:         'danger',
    });
    if (!ok) return;
    await this.store.deleteConnection(c.id);
  }

  protected statusLabel(status: FintsConnectionStatus): string {
    return STATUS_VARIANTS[status].label;
  }

  protected statusTone(status: FintsConnectionStatus): StatusVariant['tone'] {
    return STATUS_VARIANTS[status].tone;
  }

  protected connectionTone(c: FintsConnectionResponse): string {
    if (c.status === 'ACTIVE') return 'var(--success)';
    if (c.status === 'REAUTH_REQUIRED' || c.status === 'TAN_REQUIRED') return 'var(--accent)';
    if (c.status === 'ERROR') return 'var(--danger)';
    return 'var(--cat-gesund)';
  }
}
