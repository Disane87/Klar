import { Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { KlarAvatarComponent } from '../../../shared/ui/klar-avatar.component';
import { KlarFilterBarComponent } from '../../../shared/ui/klar-filter-bar.component';
import { KlarSectionHeaderComponent } from '../../../shared/ui/klar-section-header.component';
import { KlarVirtualListComponent } from '../../../shared/ui/klar-virtual-list.component';
import { HlmInputDirective } from '../../../shared/ui/hlm/hlm-input.directive';
import { AdminApiService, type AuditFilter, type AuditLogEntry } from '../admin.service';
import { usePaginatedList } from './use-paginated-list';

@Component({
  selector: 'klar-admin-audit-tab',
  standalone: true,
  imports: [
    FormsModule,
    HlmInputDirective,
    KlarAvatarComponent,
    KlarFilterBarComponent,
    KlarSectionHeaderComponent,
    KlarVirtualListComponent,
  ],
  template: `
    <div class="flex flex-col gap-3 h-full">
      <klar-filter-bar>
        <label class="flex flex-col gap-1 min-w-[220px] flex-1">
          <span hlmLabel>Suche</span>
          <input hlmInput placeholder="Aktion enthält…" [ngModel]="filterQ()" (ngModelChange)="onQ($event)" />
        </label>
        <label class="flex flex-col gap-1 min-w-[180px]">
          <span hlmLabel>Aktion-Prefix</span>
          <input hlmInput placeholder="z.B. user. oder mcp." [ngModel]="filterPrefix()" (ngModelChange)="onPrefix($event)" />
        </label>
        <label class="flex flex-col gap-1 min-w-[200px]">
          <span hlmLabel>User-ID</span>
          <input hlmInput placeholder="cuid…" [ngModel]="filterUserId()" (ngModelChange)="onUserId($event)" />
        </label>
        <label class="flex flex-col gap-1 min-w-[200px]">
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
            <div class="grid grid-cols-[160px_1fr_220px_220px_140px] gap-3 items-center px-3 text-sm w-full border-b border-border/50">
              <span class="font-mono tabular-nums text-xs whitespace-nowrap">{{ formatDt(item.createdAt) }}</span>
              <span class="font-mono text-xs truncate" [title]="item.action">{{ item.action }}</span>
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
              <span class="font-mono text-xs text-muted-foreground truncate">{{ item.ip ?? '—' }}</span>
            </div>
          </ng-template>
          <ng-template #empty>
            <div class="text-sm text-muted-foreground text-center py-12">Keine Audit-Einträge</div>
          </ng-template>
        </klar-virtual-list>
      </div>
    </div>
  `,
})
export class AdminAuditTabComponent {
  private api = inject(AdminApiService);

  protected readonly rowH = 44;

  protected list = usePaginatedList<AuditLogEntry, AuditFilter>({
    fetch: (filter, cursor) => this.api.listAuditLogs(filter, cursor),
    initialFilter: {},
  });

  protected filterQ = computed(() => this.list.filter().q ?? '');
  protected filterPrefix = computed(() => this.list.filter().actionPrefix ?? '');
  protected filterUserId = computed(() => this.list.filter().userId ?? '');
  protected filterHhId = computed(() => this.list.filter().householdId ?? '');

  protected header = computed(() => {
    const total = this.list.total();
    return total !== null ? `Audit Log (${total})` : 'Audit Log';
  });

  protected onQ(v: string): void {
    this.list.setFilter((f) => ({ ...f, q: v.trim() || undefined }));
  }
  protected onPrefix(v: string): void {
    this.list.setFilter((f) => ({ ...f, actionPrefix: v.trim() || undefined }));
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
    });
  }
}
