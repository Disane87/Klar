import { Component, computed, effect, inject, OnInit, signal } from '@angular/core';
import {
  AdminHealthStore,
  type AdminHealthJob,
  type LiveLogEntry,
} from '../../core/admin/admin-health.store';
import { PageHeaderService } from '../../core/page-header/page-header.service';
import { HlmInputDirective } from '../../shared/ui/hlm/hlm-input.directive';
import { KlarButtonComponent } from '../../shared/ui/klar-button.component';
import { KlarIconComponent } from '../../shared/icons/klar-icon.component';
import { KlarHeroComponent } from '../../shared/ui/klar-hero.component';
import { KlarStatTileComponent, type KlarStatTileTone } from '../../shared/ui/klar-stat-tile.component';
import { AdminAuditTabComponent } from './tabs/audit-tab.component';
import { AdminEmailsTabComponent } from './tabs/emails-tab.component';
import { AdminHouseholdsTabComponent } from './tabs/households-tab.component';
import { AdminMcpTabComponent } from './tabs/mcp-tab.component';

type Tab = 'audit' | 'mcp' | 'emails' | 'households';
type Tone = 'ok' | 'warn' | '';

const TABS: ReadonlyArray<{ id: Tab; label: string }> = [
  { id: 'audit',      label: 'Audit-Log' },
  { id: 'mcp',        label: 'MCP Calls' },
  { id: 'emails',     label: 'E-Mails' },
  { id: 'households', label: 'Households' },
];

const JOB_ICONS: Record<string, string> = {
  Backup: 'key',
  Mail:   'mail',
  CSV:    'arrow-up-right',
};

@Component({
  selector: 'klar-admin-page',
  standalone: true,
  imports: [
    HlmInputDirective,
    KlarButtonComponent,
    KlarIconComponent,
    KlarHeroComponent,
    KlarStatTileComponent,
    AdminAuditTabComponent,
    AdminEmailsTabComponent,
    AdminHouseholdsTabComponent,
    AdminMcpTabComponent,
  ],
  template: `
    <div class="flex flex-col gap-(--s-5) p-(--s-6) max-w-350 mx-auto pb-(--s-8)">

      <!-- Hero -->
      <klar-hero
        variant="admin"
        [eyebrow]="'Klar Self-Host · ' + instanceHost()"
        [title]="heroTitle()"
        [sub]="heroDescription()"
      >
        <ng-container heroActions>
          <klar-button tone="ghost"   size="sm" icon="pulse">Live-Statistik</klar-button>
          <klar-button tone="primary" size="sm" icon="key">Backup jetzt</klar-button>
        </ng-container>
      </klar-hero>

      <!-- Status grid -->
      <section class="grid grid-cols-2 md:grid-cols-4 gap-(--s-3)">
        <klar-stat-tile
          icon="pulse"
          label="Uptime · 30 T"
          [value]="uptimeText()"
          [delta]="uptimeDelta()"
          [tone]="statTone(uptimeTone())"
        />
        <klar-stat-tile
          icon="key"
          label="Datenbank"
          [value]="dbSizeText()"
          delta="Postgres total"
        />
        <klar-stat-tile
          icon="alert"
          label="Warnungen"
          [value]="warningText()"
          delta="letzte 24 h"
          [tone]="statTone(warningTone())"
        />
        <klar-stat-tile
          icon="haushalt"
          label="Aktive Sessions"
          [value]="sessionsText()"
          delta="Refresh-Tokens"
        />
      </section>

      <!-- Side-by-side: Dienste + Performance -->
      <section class="admin-grid-2">
        <div class="admin-card">
          <div class="admin-card-head">
            <klar-icon name="pulse" [size]="13" />
            <span class="h">Dienste</span>
            <span class="sub mono">{{ servicesOnlineText() }}</span>
          </div>
          <div class="admin-services">
            @for (s of services(); track s.name) {
              <div class="admin-service" [class.warn]="s.state === 'warn'" [class.error]="s.state === 'error'">
                <span class="admin-service-light"></span>
                <div>
                  <div class="admin-service-name">{{ s.name }}</div>
                  <div class="admin-service-meta">{{ s.meta }}</div>
                </div>
                <div class="admin-uptime" aria-hidden="true">
                  @for (b of s.uptimeBars; track $index) {
                    <i [class.warn]="b > 0 && b < 1" [class.bad]="b === 0"></i>
                  }
                </div>
                <button type="button"
                        class="hlm-btn-ghost h-7 w-7 grid place-items-center rounded text-(--fg-2) hover:text-(--fg)"
                        [attr.aria-label]="'Aktionen für ' + s.name">
                  <klar-icon name="menu" [size]="12" />
                </button>
              </div>
            }
            @if (!services().length) {
              <p class="text-[12px] text-(--fg-2) px-4 py-3">Lade Service-Status …</p>
            }
          </div>
        </div>

        <div class="admin-card">
          <div class="admin-card-head">
            <klar-icon name="trending" [size]="13" />
            <span class="h">Performance · letzte 5 Min.</span>
          </div>
          <div class="admin-perf">
            @for (row of performance(); track row.key) {
              <div class="admin-perf-row" [class.warn]="row.state === 'warn'">
                <span class="admin-perf-label">{{ row.label }}</span>
                <div class="admin-perf-bar"><i [style.width.%]="row.pct"></i></div>
                <span class="admin-perf-val">{{ row.valueText }}</span>
              </div>
            }
            @if (!performance().length) {
              <p class="text-[12px] text-(--fg-2)">Lade Performance-Daten …</p>
            }
          </div>
        </div>
      </section>

      <!-- Side-by-side: Geplante Jobs + (Sparkline + Live-Log) -->
      <section class="admin-grid-2">
        <div class="admin-card">
          <div class="admin-card-head">
            <klar-icon name="refresh" [size]="13" />
            <span class="h">Geplante Jobs</span>
            <span class="sub mono">{{ jobs().length }} aktiv</span>
          </div>
          <div class="admin-jobs">
            @for (j of jobs(); track j.name) {
              <div class="admin-job">
                <div class="admin-job-icon"><klar-icon [name]="jobIcon(j.name)" [size]="14" /></div>
                <div>
                  <div class="admin-job-name">{{ j.name }}</div>
                  <div class="admin-job-meta">{{ jobMeta(j) }}</div>
                </div>
                <span class="admin-job-when">{{ jobWhen(j) }}</span>
                <button type="button"
                        class="hlm-btn-ghost h-7 w-7 grid place-items-center rounded text-(--fg-2) hover:text-(--fg)"
                        [attr.aria-label]="'Job ' + j.name + ' ausführen'">
                  <klar-icon name="chevron-right" [size]="12" />
                </button>
              </div>
            }
            @if (!jobs().length) {
              <p class="text-[12px] text-(--fg-2) px-4 py-3">Keine Jobs registriert.</p>
            }
          </div>
        </div>

        <div class="admin-card">
          <div class="admin-card-head">
            <klar-icon name="pulse" [size]="13" />
            <span class="h">DB-Queries / Min.</span>
          </div>
          <div class="admin-spark">
            <svg class="admin-spark-svg" viewBox="0 0 200 60" preserveAspectRatio="none" aria-hidden="true">
              <defs>
                <linearGradient id="adminSparkGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.45" />
                  <stop offset="100%" stop-color="var(--accent)" stop-opacity="0" />
                </linearGradient>
              </defs>
              @if (sparkArea()) {
                <path [attr.d]="sparkArea()" fill="url(#adminSparkGrad)" />
              }
              @if (sparkLine()) {
                <path [attr.d]="sparkLine()" fill="none" stroke="var(--accent)" stroke-width="1.5" />
              }
            </svg>
            <div class="admin-spark-legend">
              <span><i style="background: var(--accent);"></i> Queries/Min.</span>
              <span class="ml-auto mono">peak {{ dbQueries().peak }} · avg {{ dbQueries().avg }}</span>
            </div>
          </div>
          <div class="admin-card-head" style="border-top: 1px solid var(--line-soft); border-bottom: 0;">
            <klar-icon name="info" [size]="13" />
            <span class="h">Live-Log</span>
            <klar-button tone="ghost" size="sm" icon="arrow-down-right" class="ml-auto">Exportieren</klar-button>
          </div>
          <div class="admin-log">
            @for (e of liveLog(); track $index) {
              <div class="admin-log-row">
                <span class="ts">{{ formatLogTime(e.ts) }}</span>
                <span class="lvl {{ logLevelClass(e) }}">{{ logLevelLabel(e) }}</span>
                <span class="msg">{{ e.msg }}</span>
              </div>
            }
            @if (!liveLog().length) {
              <div class="admin-log-row"><span class="msg" style="color: var(--fg-2);">Noch keine Log-Einträge erfasst.</span></div>
            }
          </div>
        </div>
      </section>

      <!-- Tabs row -->
      <nav class="flex items-end gap-(--s-5) border-b border-(--line-soft) text-[13px]">
        @for (t of TABS; track t.id) {
          <button type="button"
                  (click)="setTab(t.id)"
                  class="pb-2 -mb-px border-b-2 transition-colors"
                  [class.border-(--accent)]="tab() === t.id"
                  [class.border-transparent]="tab() !== t.id"
                  [class.text-(--fg)]="tab() === t.id"
                  [class.text-(--fg-2)]="tab() !== t.id"
                  [class.font-medium]="tab() === t.id">
            {{ t.label }}
          </button>
        }
      </nav>

      <div class="flex items-center gap-(--s-2)">
        <div class="relative flex-1 max-w-90">
          <klar-icon name="search" [size]="14"
                     class="absolute top-1/2 left-2 -translate-y-1/2 text-(--fg-2) pointer-events-none" />
          <input hlmInput type="search" placeholder="Suchen — Akteur, Methode, IP …"
                 class="pl-8 w-full"
                 [value]="search()" (input)="search.set($any($event.target).value)" />
        </div>
        <klar-button tone="ghost" size="sm" icon="filter">Filter</klar-button>
        <span class="ml-auto text-[12px] text-(--fg-2) mono">
          {{ totalCountText() }} · virtualisiert
        </span>
      </div>

      <div class="flex-1 min-h-0">
        @switch (tab()) {
          @case ('audit') {
            <klar-admin-audit-tab (totalChange)="auditCount.set(format($event))" />
          }
          @case ('mcp') {
            <klar-admin-mcp-tab (totalChange)="mcpCount.set(format($event))" />
          }
          @case ('emails') {
            <klar-admin-emails-tab (totalChange)="emailCount.set(format($event))" />
          }
          @case ('households') {
            <klar-admin-households-tab (totalChange)="householdCount.set(format($event))" />
          }
        }
      </div>
    </div>
  `,
})
export class AdminPageComponent implements OnInit {
  private pageHeader = inject(PageHeaderService);
  private healthStore = inject(AdminHealthStore);

  protected readonly TABS = TABS;
  protected readonly tab = signal<Tab>('audit');
  protected readonly search = signal<string>('');

  // Tab totals — surfaced from each tab via (totalChange).
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
  protected readonly dbQueries = this.healthStore.dbQueries;
  protected readonly liveLog = this.healthStore.liveLog;

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
    const days = this.uptimeDays();
    const suffix = days !== null ? ` — seit ${days} ${days === 1 ? 'Tag' : 'Tagen'}.` : '';
    const s = this.healthStore.heroState();
    if (s === 'ok')   return `Alles läuft${suffix}`;
    if (s === 'warn') return `Eingeschränkt${suffix}`;
    return `Vorfall aktiv${suffix}`;
  });

  protected readonly heroDescription = signal<string>(
    'Postgres 16, OIDC via Authentik, S3-kompatibles Backup auf Hetzner. ' +
    'Letzter Backup-Sync vor wenigen Stunden, nächster automatischer Lauf um 03:00.',
  );

  // ── Tile state tones ─────────────────────────────────────────────────────

  protected readonly uptimeTone = computed<Tone>(() => {
    const v = this.healthStore.status()?.uptimePct;
    if (v === undefined) return '';
    if (v >= 99.9) return 'ok';
    if (v < 99.5) return 'warn';
    return '';
  });

  protected readonly warningTone = computed<Tone>(() =>
    (this.healthStore.status()?.warningCount ?? 0) > 0 ? 'warn' : '',
  );

  protected readonly uptimeDelta = computed<string>(() => {
    const incident = this.healthStore.status()?.lastIncident;
    if (!incident) return 'rolling window';
    const date = new Date(incident.atIso);
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    return `${incident.durationSeconds} s Ausfall am ${dd}.${mm}.`;
  });

  protected readonly servicesOnlineText = computed<string>(() => {
    const list = this.services();
    if (list.length === 0) return '— / —';
    const ok = list.filter((s) => s.state === 'ok').length;
    return `${ok} / ${list.length} online`;
  });

  protected readonly totalCountText = computed<string>(() => {
    switch (this.tab()) {
      case 'audit':      return this.auditCount() + ' Einträge';
      case 'mcp':        return this.mcpCount() + ' Calls';
      case 'emails':     return this.emailCount() + ' E-Mails';
      case 'households': return this.householdCount() + ' Haushalte';
    }
  });

  // ── DB-Queries sparkline ─────────────────────────────────────────────────

  /** Renders the polyline path for the DB-Queries sparkline (200×60 viewBox). */
  protected readonly sparkLine = computed<string | null>(() => {
    const pts = this.dbQueries().points;
    if (pts.length < 2) return null;
    const max = Math.max(...pts, 1);
    const stepX = 200 / (pts.length - 1);
    return pts
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${(i * stepX).toFixed(2)} ${(60 - (p / max) * 56).toFixed(2)}`)
      .join(' ');
  });

  /** Closed area under the spark line for the gradient fill. */
  protected readonly sparkArea = computed<string | null>(() => {
    const line = this.sparkLine();
    if (!line) return null;
    return `${line} L 200 60 L 0 60 Z`;
  });

  // ── Live-log row helpers ─────────────────────────────────────────────────

  protected formatLogTime(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }

  protected logLevelClass(e: LiveLogEntry): string {
    if (e.level === 'error' || e.level === 'fatal') return 'error';
    if (e.level === 'warn') return 'warn';
    if (e.level === 'info') return /\b(ok|success|complete|done)\b/i.test(e.msg) ? 'ok' : 'info';
    return 'info';
  }

  protected logLevelLabel(e: LiveLogEntry): string {
    return this.logLevelClass(e).toUpperCase();
  }

  // ── Job row helpers ──────────────────────────────────────────────────────

  protected jobIcon(name: string): string {
    for (const key of Object.keys(JOB_ICONS)) {
      if (name.toLowerCase().includes(key.toLowerCase())) return JOB_ICONS[key]!;
    }
    return 'refresh';
  }

  protected jobMeta(job: AdminHealthJob): string {
    const last = job.lastRunIso ? `letzte: ${this.formatJobTimestamp(job.lastRunIso)}` : 'noch nicht gelaufen';
    return `${job.cron} · ${last}`;
  }

  protected jobWhen(job: AdminHealthJob): string {
    if (!job.nextRunIso) return '—';
    const diffMs = new Date(job.nextRunIso).getTime() - Date.now();
    if (Number.isNaN(diffMs)) return '—';
    const diffMin = Math.round(diffMs / 60_000);
    if (diffMin < 0)   return 'überfällig';
    if (diffMin < 60)  return `in ${diffMin} Min.`;
    if (diffMin < 60 * 24) return `in ${Math.round(diffMin / 60)} Std.`;
    return `in ${Math.round(diffMin / (60 * 24))} T`;
  }

  private formatJobTimestamp(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${dd}.${mm}. ${hh}:${min}`;
  }

  private uptimeDays(): number | null {
    const pct = this.healthStore.status()?.uptimePct;
    if (pct === undefined) return null;
    // Approximation against a 30-day window (matches uptimeWindow on the API).
    return Math.max(1, Math.round((pct / 100) * 30));
  }

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

  protected statTone(t: Tone): KlarStatTileTone {
    return t === '' ? 'neutral' : t;
  }

  protected format(n: number | null): string {
    return n === null ? '—' : n.toLocaleString('de-DE');
  }
}
