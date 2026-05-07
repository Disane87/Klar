import { Component, inject, OnInit, signal } from '@angular/core';
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
      <!-- Admin hero — bundle PageAdmin admin-hero card -->
      <section class="card flex flex-col md:flex-row gap-(--s-4) p-5 items-start md:items-center">
        <div class="flex-1 min-w-0 flex flex-col gap-1">
          <span class="eyebrow">Klar Self-Host · {{ instanceHost() }}</span>
          <h1 class="text-[24px] md:text-[28px] leading-none"
              style="font-family: var(--font-display); letter-spacing: -0.02em; font-weight: 500;">
            Alles läuft.
          </h1>
          <p class="text-[12px] text-(--fg-2) max-w-prose mt-1">
            Audit-Log, MCP-Tool-Calls, ausgehende E-Mails und alle Haushalte dieser Instanz —
            zentralisiert für die System-Übersicht.
          </p>
        </div>
        <div class="flex flex-col gap-2 shrink-0">
          <span class="chip success dot self-start md:self-end">v{{ version() }} healthy</span>
        </div>
      </section>

      <!-- Header stats — 4 metric tiles, 2 col on mobile, 4 col ≥ md -->
      <section class="grid grid-cols-2 md:grid-cols-4 gap-3">
        <klar-metric-tile label="Audit-Log" [value]="auditCount()" sub="Einträge gesamt" />
        <klar-metric-tile label="MCP-Calls" [value]="mcpCount()"   sub="Tool-Aufrufe" />
        <klar-metric-tile label="E-Mails"   [value]="emailCount()" sub="protokolliert" />
        <klar-metric-tile label="Haushalte" [value]="householdCount()" sub="aktiv" accent />
      </section>

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

  protected readonly tab = signal<Tab>('audit');

  // Header stat tiles — populated by child tab components via totalChange.
  // Strings (not numbers) so an unknown total renders as "—" without 0-flash.
  protected readonly auditCount     = signal('—');
  protected readonly mcpCount       = signal('—');
  protected readonly emailCount     = signal('—');
  protected readonly householdCount = signal('—');

  /** Hostname of the instance — bundle hero shows klar.local; resolves at runtime. */
  protected readonly instanceHost = signal<string>(
    typeof window !== 'undefined' ? window.location.hostname : 'klar.local',
  );
  /** Version string for the hero chip; will be wired to /version once API exposes it. */
  protected readonly version = signal('1.0.0');

  ngOnInit(): void {
    this.pageHeader.set({ title: 'Admin', subtitle: 'System · Self-Host Instanz' });
  }

  protected setTab(t: Tab): void {
    this.tab.set(t);
  }

  protected format(n: number | null): string {
    return n === null ? '—' : n.toLocaleString('de-DE');
  }
}
