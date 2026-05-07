import { Component, inject, OnInit, signal } from '@angular/core';
import { PageHeaderService } from '../../core/page-header/page-header.service';
import { HlmTabsImports } from '../../shared/ui/hlm/hlm-tabs';
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
    AdminAuditTabComponent,
    AdminEmailsTabComponent,
    AdminHouseholdsTabComponent,
    AdminMcpTabComponent,
  ],
  template: `
    <div [hlmTabs]="tab()"
         class="flex flex-col gap-4 p-4 md:p-6 max-w-350 mx-auto h-[calc(100dvh-var(--page-header-h,64px))]"
         (hlmTabsChange)="setTab($any($event))">
      <div hlmTabsList class="self-start flex-wrap">
        <button hlmTabsTrigger="audit">Audit Log</button>
        <button hlmTabsTrigger="mcp">MCP</button>
        <button hlmTabsTrigger="emails">E-Mails</button>
        <button hlmTabsTrigger="households">Haushalte</button>
      </div>

      <div class="flex-1 min-h-0">
        <div hlmTabsContent="audit"><klar-admin-audit-tab /></div>
        <div hlmTabsContent="mcp"><klar-admin-mcp-tab /></div>
        <div hlmTabsContent="emails"><klar-admin-emails-tab /></div>
        <div hlmTabsContent="households"><klar-admin-households-tab /></div>
      </div>
    </div>
  `,
})
export class AdminPageComponent implements OnInit {
  private pageHeader = inject(PageHeaderService);

  protected readonly tab = signal<Tab>('audit');

  ngOnInit(): void {
    this.pageHeader.set({ title: 'Admin', subtitle: 'System-weite Übersicht' });
  }

  protected setTab(t: Tab): void {
    this.tab.set(t);
  }
}
