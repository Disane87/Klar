import { Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HlmBadgeDirective } from '../../../shared/ui/hlm/hlm-badge.directive';
import { HlmInputDirective } from '../../../shared/ui/hlm/hlm-input.directive';
import { HlmSelectNativeDirective } from '../../../shared/ui/hlm/hlm-select/hlm-select-native.directive';
import { KlarFilterBarComponent } from '../../../shared/ui/klar-filter-bar.component';
import { KlarSectionHeaderComponent } from '../../../shared/ui/klar-section-header.component';
import { KlarVirtualListComponent } from '../../../shared/ui/klar-virtual-list.component';
import { AdminApiService, type EmailFilter, type EmailLogEntry } from '../admin.service';
import { usePaginatedList } from '../../../shared/data/use-paginated-list';

@Component({
  selector: 'klar-admin-emails-tab',
  standalone: true,
  imports: [
    FormsModule,
    HlmBadgeDirective,
    HlmInputDirective,
    HlmSelectNativeDirective,
    KlarFilterBarComponent,
    KlarSectionHeaderComponent,
    KlarVirtualListComponent,
  ],
  template: `
    <div class="flex flex-col gap-3 h-full">
      <klar-filter-bar>
        <label class="flex flex-col gap-1 min-w-[240px] flex-1">
          <span hlmLabel>Suche</span>
          <input hlmInput placeholder="An / Betreff…" [ngModel]="filterQ()" (ngModelChange)="onQ($event)" />
        </label>
        <label class="flex flex-col gap-1 min-w-[140px]">
          <span hlmLabel>Status</span>
          <select hlmSelect class="scheme-dark" [ngModel]="filterStatus()" (ngModelChange)="onStatus($event)">
            <option [ngValue]="''">Alle</option>
            <option [ngValue]="'SENT'">SENT</option>
            <option [ngValue]="'FAILED'">FAILED</option>
          </select>
        </label>
        <label class="flex flex-col gap-1 min-w-[180px]">
          <span hlmLabel>Template</span>
          <input hlmInput placeholder="z.B. invite" [ngModel]="filterTemplate()" (ngModelChange)="onTemplate($event)" />
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
            <div class="grid grid-cols-[140px_70px_220px_140px_1fr] gap-3 items-center px-3 text-sm w-full border-b border-border/50">
              <span class="font-mono tabular-nums text-xs whitespace-nowrap">{{ formatDt(item.sentAt) }}</span>
              <span>
                @if (item.status === 'SENT') {
                  <span hlmBadge class="bg-success/15 text-success">SENT</span>
                } @else {
                  <span hlmBadge class="bg-danger/15 text-danger" [title]="item.error ?? ''">FAILED</span>
                }
              </span>
              <span class="truncate text-xs">{{ item.to }}</span>
              <span class="font-mono text-xs truncate" [title]="item.template">{{ item.template }}</span>
              <span class="truncate text-xs text-muted-foreground" [title]="item.subject">{{ item.subject }}</span>
            </div>
          </ng-template>
          <ng-template #empty>
            <div class="text-sm text-muted-foreground text-center py-12">Keine Mails</div>
          </ng-template>
        </klar-virtual-list>
      </div>
    </div>
  `,
})
export class AdminEmailsTabComponent {
  private api = inject(AdminApiService);

  protected readonly rowH = 44;

  protected list = usePaginatedList<EmailLogEntry, EmailFilter>({
    fetch: (filter, cursor) => this.api.listEmails(filter, cursor),
    initialFilter: {},
  });

  protected filterQ = computed(() => this.list.filter().q ?? '');
  protected filterStatus = computed(() => this.list.filter().status ?? '');
  protected filterTemplate = computed(() => this.list.filter().template ?? '');

  protected header = computed(() => {
    const total = this.list.total();
    return total !== null ? `E-Mails (${total})` : 'E-Mails';
  });

  protected onQ(v: string): void {
    this.list.setFilter((f) => ({ ...f, q: v.trim() || undefined }));
  }
  protected onStatus(v: string): void {
    const status = v === 'SENT' || v === 'FAILED' ? v : null;
    this.list.setFilter((f) => ({ ...f, status }));
  }
  protected onTemplate(v: string): void {
    this.list.setFilter((f) => ({ ...f, template: v.trim() || undefined }));
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
