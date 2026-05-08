import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { PageHeaderService } from '../../core/page-header/page-header.service';
import { FintsStore } from '../../core/fints/fints.store';
import type {
  FintsConnectionResponse,
  FintsConnectionStatus,
} from '../../core/fints/fints.service';
import { KlarButtonComponent } from '../../shared/ui/klar-button.component';
import { KlarBadgeComponent } from '../../shared/ui/klar-badge.component';
import { KlarMetricTileComponent } from '../../shared/ui/klar-metric-tile.component';
import { KlarEmptyStateComponent } from '../../shared/ui/klar-empty-state.component';
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
    KlarMetricTileComponent,
    KlarEmptyStateComponent,
    KlarIconComponent,
  ],
  template: `
    <div class="flex flex-col gap-(--s-6) p-(--s-6) pb-16">
      <!-- Hero strip -->
      <section
        class="rounded-lg border border-(--line) bg-(--bg-1) px-5 py-5 flex flex-col md:flex-row gap-(--s-6) items-stretch"
        style="box-shadow: var(--shadow-1);"
      >
        <div class="flex-1 min-w-0 flex flex-col gap-2">
          <span class="eyebrow inline-flex items-center gap-2">
            <klar-icon name="wallet" [size]="11" /> FinTS-Bankzugriff
          </span>
          <span
            class="text-[20px] font-medium leading-tight"
            style="font-family: var(--font-display); letter-spacing: -0.02em;"
          >
            {{ heroTitle() }}
          </span>
          <p class="text-[13px] text-(--fg-2) max-w-prose">
            Verbinde dein Online-Banking, damit Buchungen automatisch ankommen — ohne CSV-Export.
            Klar speichert deinen PIN nur verschlüsselt und nie auf einem fremden Server.
          </p>
        </div>
        <div class="grid grid-cols-2 md:grid-cols-3 gap-3 shrink-0">
          <klar-metric-tile label="Aktive Verbindungen" [value]="activeCount() + ''" />
          <klar-metric-tile
            label="Letzter Sync"
            [value]="lastSyncLabel()"
          />
          <klar-metric-tile
            label="Aufmerksamkeit"
            [value]="reauthCount() + ''"
            [accent]="reauthCount() > 0"
          />
        </div>
      </section>

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
      <div class="flex items-center justify-between">
        <span class="text-[12px] text-(--fg-2)">
          @if (store.connections()?.length) {
            {{ store.connections()?.length }} Verbindung{{ store.connections()?.length === 1 ? '' : 'en' }}
          } @else {
            Noch keine Verbindungen
          }
        </span>
        <klar-button tone="primary" size="sm" icon="plus" (click)="openSetupWizard()">
          Bank verbinden
        </klar-button>
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
              class="rounded-md border border-(--line-soft) bg-(--bg-1) overflow-hidden transition-colors hover:bg-(--bg-2)"
            >
              <div
                class="cat-bar px-4 py-3 grid gap-3"
                style="grid-template-columns: 1fr auto auto; align-items: center;"
                [style.--cat-color]="connectionTone(c)"
              >
                <div class="min-w-0">
                  <div class="text-[14px] font-medium truncate text-(--fg)">{{ c.bankName }}</div>
                  <div class="text-[11px] text-(--fg-2) truncate mono">
                    BLZ {{ c.blz }} · {{ c.loginName }}
                  </div>
                </div>
                <div class="hidden md:flex flex-col items-end gap-1 min-w-35">
                  <klar-badge [tone]="statusTone(c.status)">{{ statusLabel(c.status) }}</klar-badge>
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
                    icon="planspiel"
                    [disabled]="!!store.syncing()"
                    [aria-label]="'Jetzt synchronisieren'"
                    (click)="onSync(c.id)"
                  />
                  <klar-button
                    tone="ghost"
                    size="sm"
                    icon="x"
                    [disabled]="store.deleting() === c.id"
                    [aria-label]="'Verbindung löschen'"
                    (click)="onDelete(c)"
                  />
                </div>
              </div>
              @if (c.status === 'REAUTH_REQUIRED') {
                <div class="px-4 py-2 border-t border-(--line-soft) bg-(--accent-soft) text-[12px] text-(--accent)">
                  Diese Verbindung verlangt eine frische TAN-Bestätigung.
                </div>
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

  protected readonly activeCount = computed(
    () => this.store.connections()?.filter(c => c.status === 'ACTIVE').length ?? 0,
  );

  protected readonly reauthCount = computed(
    () => this.store.connections()?.filter(c => c.status === 'REAUTH_REQUIRED').length ?? 0,
  );

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
