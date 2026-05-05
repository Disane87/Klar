import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { PageHeaderService } from '../../core/page-header/page-header.service';
import { HlmButtonDirective } from '../../shared/ui/hlm/hlm-button.directive';
import { HlmBadgeDirective } from '../../shared/ui/hlm/hlm-badge.directive';
import { KlarSectionHeaderComponent } from '../../shared/ui/klar-section-header.component';
import { KlarAvatarComponent } from '../../shared/ui/klar-avatar.component';
import {
  AdminApiService,
  type AdminHousehold,
  type AuditLogEntry,
  type EmailLogEntry,
} from './admin.service';

type Tab = 'audit' | 'emails' | 'households';

@Component({
  selector: 'klar-admin-page',
  standalone: true,
  imports: [
    HlmButtonDirective,
    HlmBadgeDirective,
    KlarSectionHeaderComponent,
    KlarAvatarComponent,
  ],
  template: `
    <div class="flex flex-col gap-4 p-4 md:p-6 max-w-6xl mx-auto">
      <div class="flex flex-wrap gap-2">
        <button
          hlmBtn
          [variant]="tab() === 'audit' ? 'default' : 'outline'"
          (click)="setTab('audit')"
        >Audit Log</button>
        <button
          hlmBtn
          [variant]="tab() === 'emails' ? 'default' : 'outline'"
          (click)="setTab('emails')"
        >E-Mails</button>
        <button
          hlmBtn
          [variant]="tab() === 'households' ? 'default' : 'outline'"
          (click)="setTab('households')"
        >Haushalte</button>
      </div>

      @if (loading()) {
        <div class="text-sm text-muted-foreground py-8 text-center">Lade …</div>
      } @else if (error()) {
        <div class="text-sm text-danger py-8 text-center">{{ error() }}</div>
      } @else {
        @switch (tab()) {
          @case ('audit') { @if (auditData(); as a) {
            <klar-section-header [title]="'Audit Log (' + a.total + ')'" />
            <div class="overflow-x-auto rounded border border-border">
              <table class="w-full text-sm">
                <thead class="bg-muted/40 text-left text-[10px] uppercase tracking-widest text-muted-foreground">
                  <tr>
                    <th class="px-3 py-2">Zeit</th>
                    <th class="px-3 py-2">Aktion</th>
                    <th class="px-3 py-2">User</th>
                    <th class="px-3 py-2">Haushalt</th>
                    <th class="px-3 py-2">IP</th>
                  </tr>
                </thead>
                <tbody>
                  @for (l of a.data; track l.id) {
                    <tr class="border-t border-border align-top">
                      <td class="px-3 py-1.5 font-mono tabular-nums whitespace-nowrap">
                        {{ formatDateTime(l.createdAt) }}
                      </td>
                      <td class="px-3 py-1.5 font-mono">{{ l.action }}</td>
                      <td class="px-3 py-1.5 text-muted-foreground">{{ l.userId ?? '—' }}</td>
                      <td class="px-3 py-1.5 text-muted-foreground">{{ l.householdId ?? '—' }}</td>
                      <td class="px-3 py-1.5 font-mono text-xs text-muted-foreground">{{ l.ip ?? '—' }}</td>
                    </tr>
                  } @empty {
                    <tr><td colspan="5" class="px-3 py-6 text-center text-muted-foreground">Keine Einträge</td></tr>
                  }
                </tbody>
              </table>
            </div>
          } }
          @case ('emails') { @if (emailData(); as e) {
            <klar-section-header [title]="'Verschickte Mails (' + e.total + ')'" />
            <div class="overflow-x-auto rounded border border-border">
              <table class="w-full text-sm">
                <thead class="bg-muted/40 text-left text-[10px] uppercase tracking-widest text-muted-foreground">
                  <tr>
                    <th class="px-3 py-2">Zeit</th>
                    <th class="px-3 py-2">Status</th>
                    <th class="px-3 py-2">An</th>
                    <th class="px-3 py-2">Template</th>
                    <th class="px-3 py-2">Betreff</th>
                  </tr>
                </thead>
                <tbody>
                  @for (m of e.data; track m.id) {
                    <tr class="border-t border-border align-top">
                      <td class="px-3 py-1.5 font-mono tabular-nums whitespace-nowrap">
                        {{ formatDateTime(m.sentAt) }}
                      </td>
                      <td class="px-3 py-1.5">
                        <span hlmBadge [class]="m.status === 'SENT' ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger'">
                          {{ m.status }}
                        </span>
                      </td>
                      <td class="px-3 py-1.5">{{ m.to }}</td>
                      <td class="px-3 py-1.5 font-mono text-xs">{{ m.template }}</td>
                      <td class="px-3 py-1.5 text-muted-foreground truncate max-w-[420px]" [title]="m.subject">
                        {{ m.subject }}
                        @if (m.error) {
                          <div class="text-xs text-danger mt-1">{{ m.error }}</div>
                        }
                      </td>
                    </tr>
                  } @empty {
                    <tr><td colspan="5" class="px-3 py-6 text-center text-muted-foreground">Keine Einträge</td></tr>
                  }
                </tbody>
              </table>
            </div>
          } }
          @case ('households') {
            <klar-section-header [title]="'Haushalte (' + (households()?.length ?? 0) + ')'" />
            <div class="space-y-3">
              @for (h of households(); track h.id) {
                <div class="rounded border border-border bg-card">
                  <div class="flex items-center justify-between px-4 py-2 border-b border-border">
                    <div>
                      <div class="font-medium">{{ h.name }}</div>
                      <div class="text-xs text-muted-foreground font-mono">{{ h.id }} · erstellt {{ formatDate(h.createdAt) }}</div>
                    </div>
                    <span hlmBadge>{{ h.members.length }} Mitglieder</span>
                  </div>
                  <ul class="divide-y divide-border">
                    @for (m of h.members; track m.userId) {
                      <li class="flex items-center gap-3 px-4 py-2">
                        <klar-avatar
                          [avatarUrl]="m.avatarUrl"
                          [seed]="m.email"
                          [initials]="initialsOf(m.displayName)"
                          [size]="32"
                        />
                        <div class="flex-1 min-w-0">
                          <div class="text-sm">{{ m.displayName }}</div>
                          <div class="text-xs text-muted-foreground truncate">{{ m.email }}</div>
                        </div>
                        <span hlmBadge [class]="m.role === 'OWNER' ? 'bg-primary/15 text-primary' : ''">
                          {{ m.role }}
                        </span>
                      </li>
                    }
                  </ul>
                </div>
              } @empty {
                <div class="text-sm text-muted-foreground text-center py-8">Keine Haushalte</div>
              }
            </div>
          }
        }
      }
    </div>
  `,
})
export class AdminPageComponent implements OnInit {
  private pageHeader = inject(PageHeaderService);
  private api = inject(AdminApiService);

  protected readonly tab = signal<Tab>('audit');
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly auditData = signal<{ data: AuditLogEntry[]; total: number } | null>(null);
  protected readonly emailData = signal<{ data: EmailLogEntry[]; total: number } | null>(null);
  protected readonly households = signal<AdminHousehold[] | null>(null);

  protected readonly hasData = computed(
    () => this.auditData() !== null || this.emailData() !== null || this.households() !== null,
  );

  ngOnInit(): void {
    this.pageHeader.set({ title: 'Admin', subtitle: 'System-weite Übersicht' });
    void this.loadTab('audit');
  }

  setTab(t: Tab): void {
    this.tab.set(t);
    void this.loadTab(t);
  }

  private async loadTab(t: Tab): Promise<void> {
    this.error.set(null);
    this.loading.set(true);
    try {
      if (t === 'audit') {
        const res = await this.api.listAuditLogs({ pageSize: 100 });
        this.auditData.set(res);
      } else if (t === 'emails') {
        const res = await this.api.listEmails({ pageSize: 100 });
        this.emailData.set(res);
      } else {
        const res = await this.api.listHouseholds();
        this.households.set(res);
      }
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Fehler beim Laden');
    } finally {
      this.loading.set(false);
    }
  }

  protected formatDateTime(iso: string): string {
    return new Date(iso).toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  protected formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  protected initialsOf(name: string): string {
    return name
      .split(/\s+/)
      .map((p) => p.charAt(0))
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }
}
