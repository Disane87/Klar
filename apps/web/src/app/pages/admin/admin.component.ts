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
    <div class="flex flex-col gap-4 p-4 md:p-6 max-w-350 mx-auto h-[calc(100dvh-var(--page-header-h,64px))]">
      <!-- Hero strip · eyebrow + Fraunces title (Klar Design Pearl) -->
      <section class="flex flex-col gap-1">
        <span class="text-[10px] uppercase tracking-[0.14em] font-medium text-(--fg-2)">
          System · Self-Host Instanz
        </span>
        <h1 class="font-(family-name:--font-display) text-[28px] md:text-[32px] font-normal leading-none tracking-[-0.02em]">
          Admin
        </h1>
        <p class="text-[12px] text-(--fg-2) max-w-prose">
          System-weite Übersicht über Audit-Log, MCP-Tool-Calls, ausgehende E-Mails
          und alle Haushalte dieser Instanz.
        </p>
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

  ngOnInit(): void {
    this.pageHeader.set({ title: 'Admin', subtitle: 'System-weite Übersicht' });
  }

  protected setTab(t: Tab): void {
    this.tab.set(t);
  }

  protected format(n: number | null): string {
    return n === null ? '—' : n.toLocaleString('de-DE');
  }
}
