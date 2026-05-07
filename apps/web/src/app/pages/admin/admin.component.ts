import { Component, computed, effect, inject, OnInit, signal } from '@angular/core';
import { AdminHealthStore } from '../../core/admin/admin-health.store';
import { PageHeaderService } from '../../core/page-header/page-header.service';
import { HlmTabsImports } from '../../shared/ui/hlm/hlm-tabs';
import { KlarMetricTileComponent } from '../../shared/ui/klar-metric-tile.component';
import { AdminAuditTabComponent } from './tabs/audit-tab.component';
import { AdminEmailsTabComponent } from './tabs/emails-tab.component';
import { AdminHouseholdsTabComponent } from './tabs/households-tab.component';
import { AdminMcpTabComponent } from './tabs/mcp-tab.component';

type Tab = 'audit' | 'mcp' | 'emails' | 'households';

@Component({
  selector: 'klar-admin-page',
  standalone: true,
  imports: [
    ...HlmTabsImports,
    KlarMetricTileComponent,
    AdminAuditTabComponent,
    AdminEmailsTabComponent,
    AdminHouseholdsTabComponent,
    AdminMcpTabComponent,
  ],
  template: `
    <div class="flex flex-col gap-4 p-(--s-6) max-w-350 mx-auto h-[calc(100dvh-var(--page-header-h,64px))]">
      <!-- Hero -->
      <section class="card flex flex-col md:flex-row gap-(--s-4) p-5 items-start md:items-center">
        <div class="flex-1 min-w-0 flex flex-col gap-1">
          <span class="eyebrow">Klar Self-Host · {{ instanceHost() }}</span>
          <h1 class="text-[24px] md:text-[28px] leading-none"
              style="font-family: var(--font-display); letter-spacing: -0.02em; font-weight: 500;">
            {{ heroTitle() }}
          </h1>
          <p class="text-[12px] text-(--fg-2) max-w-prose mt-1">
            Audit-Log, MCP-Tool-Calls, ausgehende E-Mails und alle Haushalte dieser Instanz —
            zentralisiert für die System-Übersicht.
          </p>
        </div>
        <div class="flex flex-col gap-2 shrink-0">
          <span class="chip {{ heroChipKind() }} dot self-start md:self-end">
            v{{ version() }} {{ heroChipLabel() }}
          </span>
        </div>
      </section>

      <!-- Status grid -->
      <section class="grid grid-cols-2 md:grid-cols-4 gap-3">
        <klar-metric-tile label="Uptime · 30 T" [value]="uptimeText()" sub="rolling window" />
        <klar-metric-tile label="Datenbank" [value]="dbSizeText()" sub="Postgres total" />
        <klar-metric-tile label="Warnungen" [value]="warningText()" sub="letzte 24 h" />
        <klar-metric-tile label="Aktive Sessions" [value]="sessionsText()" sub="Refresh-Tokens" accent />
      </section>

      <!-- Services card -->
      <section class="card p-5 flex flex-col gap-(--s-3)">
        <div class="flex items-center justify-between">
          <h2 class="text-[14px] font-medium">Services</h2>
          <span class="text-[10px] uppercase tracking-[0.14em] text-(--fg-2)">Last 30 Probes</span>
        </div>
        @for (s of services(); track s.name) {
          <div class="flex items-center gap-3 py-1.5 border-t first:border-t-0 border-(--line)">
            <span class="inline-block w-2 h-2 rounded-full shrink-0"
                  [class.bg-(--success)]="s.state === 'ok'"
                  [class.bg-(--warn)]="s.state === 'warn'"
                  [class.bg-(--danger)]="s.state === 'error'"></span>
            <div class="flex-1 min-w-0 flex flex-col">
              <span class="text-[13px] font-medium truncate">{{ s.name }}</span>
              <span class="text-[11px] text-(--fg-2) truncate">{{ s.meta }}</span>
            </div>
            <div class="hidden md:flex gap-px shrink-0" aria-hidden="true">
              @for (b of s.uptimeBars; track $index) {
                <span class="w-1 h-3 rounded-[1px]"
                      [class.bg-(--success)]="b >= 1"
                      [class.bg-(--warn)]="b > 0 && b < 1"
                      [class.bg-(--danger)]="b === 0"></span>
              }
            </div>
            <button type="button"
                    class="hlm-btn-ghost h-8 w-8 grid place-items-center rounded-md text-(--fg-2) hover:text-(--fg)"
                    [attr.aria-label]="'Aktionen für ' + s.name">
              <span aria-hidden="true">⋯</span>
            </button>
          </div>
        }
        @if (!services().length) {
          <p class="text-[12px] text-(--fg-2) py-3">Lade Service-Status …</p>
        }
      </section>

      <!-- Performance card -->
      <section class="card p-5 flex flex-col gap-(--s-3)">
        <div class="flex items-center justify-between">
          <h2 class="text-[14px] font-medium">Performance</h2>
          <span class="text-[10px] uppercase tracking-[0.14em] text-(--fg-2)">Live · 30 s</span>
        </div>
        @for (row of performance(); track row.key) {
          <div class="grid grid-cols-12 items-center gap-3 py-1.5 border-t first:border-t-0 border-(--line)">
            <span class="col-span-3 text-[12px] text-(--fg-2)">{{ row.label }}</span>
            <div class="col-span-7 h-1.5 rounded-full bg-(--line) overflow-hidden">
              <div class="h-full rounded-full"
                   [class.bg-(--success)]="row.state === 'ok'"
                   [class.bg-(--warn)]="row.state === 'warn'"
                   [style.width.%]="row.pct"></div>
            </div>
            <span class="col-span-2 font-(family-name:--font-mono) tabular-nums text-[12px] text-right">
              {{ row.valueText }}
            </span>
          </div>
        }
        @if (!performance().length) {
          <p class="text-[12px] text-(--fg-2) py-3">Lade Performance-Daten …</p>
        }
      </section>

      <!-- Jobs card -->
      <section class="card p-5 flex flex-col gap-(--s-3)">
        <div class="flex items-center justify-between">
          <h2 class="text-[14px] font-medium">Jobs</h2>
          <span class="text-[10px] uppercase tracking-[0.14em] text-(--fg-2)">Cron · Background</span>
        </div>
        @for (j of jobs(); track j.name) {
          <div class="grid grid-cols-12 items-center gap-3 py-1.5 border-t first:border-t-0 border-(--line)">
            <span class="col-span-4 text-[13px] font-medium truncate">{{ j.name }}</span>
            <span class="col-span-3 font-(family-name:--font-mono) text-[11px] text-(--fg-2)">{{ j.cron }}</span>
            <span class="col-span-3 text-[11px] text-(--fg-2) truncate">
              @if (j.lastRunIso) {
                Letzte: {{ j.lastRunIso }}
              } @else {
                —
              }
            </span>
            <span class="col-span-2 justify-self-end chip {{ j.state === 'ok' ? 'success' : 'warn' }} dot">
              {{ j.state === 'ok' ? 'OK' : 'Warn' }}
            </span>
          </div>
        }
        @if (!jobs().length) {
          <p class="text-[12px] text-(--fg-2) py-3">Keine Jobs registriert.</p>
        }
      </section>

      <!-- Existing tabbed tables -->
      <div [hlmTabs]="tab()"
           class="flex flex-col gap-4 flex-1 min-h-0"
           (hlmTabsChange)="setTab($any($event))">
        <div hlmTabsList class="self-start flex-wrap">
          <button hlmTabsTrigger="audit">Audit Log</button>
          <button hlmTabsTrigger="mcp">MCP</button>
          <button hlmTabsTrigger="emails">E-Mails</button>
          <button hlmTabsTrigger="households">Haushalte</button>
        </div>

        <div class="flex-1 min-h-0">
          <div hlmTabsContent="audit">
            <klar-admin-audit-tab (totalChange)="auditCount.set(format($event))" />
          </div>
          <div hlmTabsContent="mcp">
            <klar-admin-mcp-tab (totalChange)="mcpCount.set(format($event))" />
          </div>
          <div hlmTabsContent="emails">
            <klar-admin-emails-tab (totalChange)="emailCount.set(format($event))" />
          </div>
          <div hlmTabsContent="households">
            <klar-admin-households-tab (totalChange)="householdCount.set(format($event))" />
          </div>
        </div>
      </div>
    </div>
  `,
})
export class AdminPageComponent implements OnInit {
  private pageHeader = inject(PageHeaderService);
  private healthStore = inject(AdminHealthStore);

  protected readonly tab = signal<Tab>('audit');

  // Tab totals — kept for parity with previous version (still surfaced via child tabs).
  protected readonly auditCount = signal('—');
  protected readonly mcpCount = signal('—');
  protected readonly emailCount = signal('—');
  protected readonly householdCount = signal('—');

  protected readonly instanceHost = signal<string>(
    typeof window !== 'undefined' ? window.location.hostname : 'klar.local',
  );
  protected readonly version = signal('1.0.0');

  // ── Health-store derived signals ──────────────────────────────────────────
  protected readonly services = this.healthStore.services;
  protected readonly performance = this.healthStore.performance;
  protected readonly jobs = this.healthStore.jobs;

  protected readonly uptimeText = computed(() => {
    const v = this.healthStore.status()?.uptimePct;
    if (v === undefined) return '—';
    return `${v.toFixed(2)} %`;
  });

  protected readonly dbSizeText = computed(() => {
    const v = this.healthStore.status()?.dbSizeBytes;
    if (v === undefined || v === 0) return '—';
    const mb = v / (1024 * 1024);
    if (mb < 1024) return `${mb.toFixed(0)} MB`;
    return `${(mb / 1024).toFixed(2)} GB`;
  });

  protected readonly warningText = computed(() => {
    const v = this.healthStore.status()?.warningCount;
    if (v === undefined) return '—';
    return new Intl.NumberFormat('de-DE').format(v);
  });

  protected readonly sessionsText = computed(() => {
    const v = this.healthStore.status()?.activeSessions;
    if (v === undefined) return '—';
    return new Intl.NumberFormat('de-DE').format(v);
  });

  protected readonly heroChipKind = computed(() => {
    const s = this.healthStore.heroState();
    if (s === 'ok') return 'success';
    if (s === 'warn') return 'warn';
    return 'danger';
  });

  protected readonly heroChipLabel = computed(() => {
    const s = this.healthStore.heroState();
    if (s === 'ok') return 'healthy';
    if (s === 'warn') return 'degraded';
    return 'incident';
  });

  protected readonly heroTitle = computed(() => {
    const s = this.healthStore.heroState();
    if (s === 'ok') return 'Alles läuft.';
    if (s === 'warn') return 'Eingeschränkt.';
    return 'Vorfall aktiv.';
  });

  constructor() {
    this.pageHeader.set({
      title:    'Admin',
      subtitle: 'System · Self-Host Instanz',
      rhsChip:  `v${this.version()} ${this.heroChipLabel()}`,
    });

    // Keep the version/health chip in sync with health-store updates.
    effect(() => {
      this.pageHeader.rhsChip.set(`v${this.version()} ${this.heroChipLabel()}`);
    });
  }

  ngOnInit(): void {
    // no-op; header is set in the constructor (injection context for effects).
  }

  protected setTab(t: Tab): void {
    this.tab.set(t);
  }

  protected format(n: number | null): string {
    return n === null ? '—' : n.toLocaleString('de-DE');
  }
}
