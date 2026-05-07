import { Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HlmBadgeDirective } from '../../../shared/ui/hlm/hlm-badge.directive';
import { HlmInputDirective } from '../../../shared/ui/hlm/hlm-input.directive';
import { KlarSelectComponent, type KlarSelectOption } from '../../../shared/ui/klar-select.component';
import { KlarAvatarComponent } from '../../../shared/ui/klar-avatar.component';
import { KlarFilterBarComponent } from '../../../shared/ui/klar-filter-bar.component';
import { KlarSectionHeaderComponent } from '../../../shared/ui/klar-section-header.component';
import { KlarVirtualListComponent } from '../../../shared/ui/klar-virtual-list.component';
import { AdminApiService, type McpAuditEntry, type McpFilter } from '../admin.service';
import { usePaginatedList } from '../../../shared/data/use-paginated-list';

@Component({
  selector: 'klar-admin-mcp-tab',
  standalone: true,
  imports: [
    FormsModule,
    HlmBadgeDirective,
    HlmInputDirective,
    KlarSelectComponent,
    KlarAvatarComponent,
    KlarFilterBarComponent,
    KlarSectionHeaderComponent,
    KlarVirtualListComponent,
  ],
  template: `
    <div class="flex flex-col gap-3 h-full">
      <klar-filter-bar>
        <label class="flex flex-col gap-1 min-w-[200px] flex-1">
          <span hlmLabel>Suche</span>
          <input hlmInput placeholder="Aktion enthält…" [ngModel]="filterQ()" (ngModelChange)="onQ($event)" />
        </label>
        <label class="flex flex-col gap-1 min-w-[180px]">
          <span hlmLabel>Tool</span>
          <input hlmInput placeholder="z.B. transactions.list" [ngModel]="filterTool()" (ngModelChange)="onTool($event)" />
        </label>
        <label class="flex flex-col gap-1 min-w-[180px]">
          <span hlmLabel>Client-ID</span>
          <input hlmInput placeholder="klar_mcp_…" [ngModel]="filterClient()" (ngModelChange)="onClient($event)" />
        </label>
        <label class="flex flex-col gap-1 min-w-[140px]">
          <span hlmLabel>Status</span>
          <klar-select
            [options]="okOpts"
            [value]="filterOk()"
            (valueChange)="onOk($event)"
            ariaLabel="Status"
          />
        </label>
        <label class="flex flex-col gap-1 min-w-[180px]">
          <span hlmLabel>User-ID</span>
          <input hlmInput placeholder="cuid…" [ngModel]="filterUserId()" (ngModelChange)="onUserId($event)" />
        </label>
        <label class="flex flex-col gap-1 min-w-[180px]">
          <span hlmLabel>Haushalt-ID</span>
          <input hlmInput placeholder="cuid…" [ngModel]="filterHhId()" (ngModelChange)="onHhId($event)" />
        </label>
      </klar-filter-bar>

      <klar-section-header [title]="header()" />

      @if (list.error(); as err) {
        <div class="text-sm text-danger py-2">{{ err }}</div>
      }

      <div class="flex-1 min-h-[400px] rounded border border-border">
        <klar-virtual-list
          [items]="list.items()"
          [itemSize]="rowH"
          [loading]="list.loading()"
          [hasMore]="list.hasMore()"
          (needMore)="list.loadMore()"
        >
          <ng-template #row let-item>
            <div
              class="grid grid-cols-[140px_1fr_220px_180px_140px_70px_70px] gap-3 items-center px-3 text-sm w-full border-b border-border/50"
            >
              <span class="font-mono tabular-nums text-xs whitespace-nowrap">{{ formatDt(item.createdAt) }}</span>
              <span class="font-mono text-xs truncate" [title]="item.toolName ?? item.action">
                {{ item.toolName ?? item.action }}
              </span>
              <span class="flex items-center gap-2 min-w-0">
                @if (item.user) {
                  <klar-avatar
                    [avatarUrl]="item.user.avatarUrl"
                    [seed]="item.user.email"
                    [size]="22"
                  />
                  <span class="truncate text-xs">
                    {{ item.user.displayName }}
                    <span class="text-muted-foreground">· {{ item.user.email }}</span>
                  </span>
                } @else {
                  <span class="text-xs text-muted-foreground">—</span>
                }
              </span>
              <span class="truncate text-xs">
                @if (item.household) {
                  {{ item.household.name }}
                } @else {
                  <span class="text-muted-foreground">—</span>
                }
              </span>
              <span class="truncate text-xs" [title]="item.clientId ?? ''">
                {{ item.clientName ?? item.clientId ?? '—' }}
              </span>
              <span class="font-mono tabular-nums text-xs text-muted-foreground text-right">
                {{ item.durationMs !== null ? item.durationMs + ' ms' : '—' }}
              </span>
              <span>
                @if (item.ok === true) {
                  <span hlmBadge class="bg-success/15 text-success">OK</span>
                } @else if (item.ok === false) {
                  <span hlmBadge class="bg-danger/15 text-danger" [title]="item.errorCode ?? ''">FAIL</span>
                } @else {
                  <span hlmBadge>–</span>
                }
              </span>
            </div>
          </ng-template>
          <ng-template #empty>
            <div class="text-sm text-muted-foreground text-center py-12">Keine MCP-Calls</div>
          </ng-template>
        </klar-virtual-list>
      </div>
    </div>
  `,
})
export class AdminMcpTabComponent {
  private api = inject(AdminApiService);

  protected readonly rowH = 44;

  protected readonly okOpts: KlarSelectOption<'' | 'true' | 'false'>[] = [
    { value: '',      label: 'Alle' },
    { value: 'true',  label: 'OK' },
    { value: 'false', label: 'Fehler' },
  ];

  protected list = usePaginatedList<McpAuditEntry, McpFilter>({
    fetch: (filter, cursor) => this.api.listMcpAuditLogs(filter, cursor),
    initialFilter: {},
  });

  protected filterQ = computed(() => this.list.filter().q ?? '');
  protected filterTool = computed(() => this.list.filter().toolName ?? '');
  protected filterClient = computed(() => this.list.filter().clientId ?? '');
  protected filterOk = computed(() => {
    const v = this.list.filter().ok;
    if (v === true) return 'true';
    if (v === false) return 'false';
    return '';
  });
  protected filterUserId = computed(() => this.list.filter().userId ?? '');
  protected filterHhId = computed(() => this.list.filter().householdId ?? '');

  protected header = computed(() => {
    const total = this.list.total();
    return total !== null ? `MCP Tool Calls (${total})` : 'MCP Tool Calls';
  });

  protected onQ(v: string): void {
    this.list.setFilter((f) => ({ ...f, q: v.trim() || undefined }));
  }
  protected onTool(v: string): void {
    this.list.setFilter((f) => ({ ...f, toolName: v.trim() || undefined }));
  }
  protected onClient(v: string): void {
    this.list.setFilter((f) => ({ ...f, clientId: v.trim() || undefined }));
  }
  protected onOk(v: string): void {
    const ok = v === 'true' ? true : v === 'false' ? false : null;
    this.list.setFilter((f) => ({ ...f, ok }));
  }
  protected onUserId(v: string): void {
    this.list.setFilter((f) => ({ ...f, userId: v.trim() || undefined }));
  }
  protected onHhId(v: string): void {
    this.list.setFilter((f) => ({ ...f, householdId: v.trim() || undefined }));
  }

  protected formatDt(iso: string): string {
    return new Date(iso).toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }
}
