import { Component, inject, OnInit, signal } from '@angular/core';
import { PageHeaderService } from '../../core/page-header/page-header.service';
import { HlmButtonDirective } from '../../shared/ui/hlm/hlm-button.directive';
import { AdminAuditTabComponent } from './tabs/audit-tab.component';
import { AdminEmailsTabComponent } from './tabs/emails-tab.component';
import { AdminHouseholdsTabComponent } from './tabs/households-tab.component';
import { AdminMcpTabComponent } from './tabs/mcp-tab.component';

type Tab = 'audit' | 'mcp' | 'emails' | 'households';

@Component({
  selector: 'klar-admin-page',
  standalone: true,
  imports: [
    HlmButtonDirective,
    AdminAuditTabComponent,
    AdminEmailsTabComponent,
    AdminHouseholdsTabComponent,
    AdminMcpTabComponent,
  ],
  template: `
    <div class="flex flex-col gap-4 p-4 md:p-6 max-w-350 mx-auto h-[calc(100dvh-var(--page-header-h,64px))]">
      <div class="flex flex-wrap gap-2">
        <button hlmBtn [variant]="tab() === 'audit' ? 'default' : 'outline'" (click)="setTab('audit')">
          Audit Log
        </button>
        <button hlmBtn [variant]="tab() === 'mcp' ? 'default' : 'outline'" (click)="setTab('mcp')">
          MCP
        </button>
        <button hlmBtn [variant]="tab() === 'emails' ? 'default' : 'outline'" (click)="setTab('emails')">
          E-Mails
        </button>
        <button hlmBtn [variant]="tab() === 'households' ? 'default' : 'outline'" (click)="setTab('households')">
          Haushalte
        </button>
      </div>

      <div class="flex-1 min-h-0">
        @switch (tab()) {
          @case ('audit') { <klar-admin-audit-tab /> }
          @case ('mcp') { <klar-admin-mcp-tab /> }
          @case ('emails') { <klar-admin-emails-tab /> }
          @case ('households') { <klar-admin-households-tab /> }
        }
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
