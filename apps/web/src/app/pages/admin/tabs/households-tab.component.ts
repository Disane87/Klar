import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HlmBadgeDirective } from '../../../shared/ui/hlm/hlm-badge.directive';
import { HlmInputDirective } from '../../../shared/ui/hlm/hlm-input.directive';
import { KlarAvatarComponent } from '../../../shared/ui/klar-avatar.component';
import { KlarFilterBarComponent } from '../../../shared/ui/klar-filter-bar.component';
import { KlarSectionHeaderComponent } from '../../../shared/ui/klar-section-header.component';
import { KlarVirtualListComponent } from '../../../shared/ui/klar-virtual-list.component';
import { AdminApiService, type AdminHousehold } from '../admin.service';

@Component({
  selector: 'klar-admin-households-tab',
  standalone: true,
  imports: [
    FormsModule,
    HlmBadgeDirective,
    HlmInputDirective,
    KlarAvatarComponent,
    KlarFilterBarComponent,
    KlarSectionHeaderComponent,
    KlarVirtualListComponent,
  ],
  template: `
    <div class="flex flex-col gap-3 h-full">
      <klar-filter-bar>
        <label class="flex flex-col gap-1 min-w-[280px] flex-1">
          <span hlmLabel>Suche</span>
          <input
            hlmInput
            placeholder="Haushalt-Name oder Member-E-Mail"
            [ngModel]="query()"
            (ngModelChange)="query.set($event)"
          />
        </label>
      </klar-filter-bar>

      <klar-section-header [title]="header()" />

      @if (error(); as err) {
        <div class="text-sm text-danger py-2">{{ err }}</div>
      }

      <div class="flex-1 min-h-[400px] rounded border border-border">
        <klar-virtual-list
          [items]="filtered()"
          [itemSize]="rowH"
          [loading]="loading()"
          [hasMore]="false"
        >
          <ng-template #row let-h>
            <div class="grid grid-cols-[1fr_220px_120px_120px] gap-3 items-center px-3 text-sm w-full border-b border-border/50">
              <span class="truncate font-medium">{{ h.name }}</span>
              <span class="flex items-center -space-x-2">
                @for (m of h.members.slice(0, 5); track m.userId) {
                  <klar-avatar
                    [avatarUrl]="m.avatarUrl"
                    [seed]="m.email"
                    [size]="22"
                  />
                }
                @if (h.members.length > 5) {
                  <span class="ml-3 text-xs text-muted-foreground">+{{ h.members.length - 5 }}</span>
                }
              </span>
              <span><span hlmBadge>{{ h.members.length }} Mitglieder</span></span>
              <span class="font-mono tabular-nums text-xs text-muted-foreground">{{ formatDate(h.createdAt) }}</span>
            </div>
          </ng-template>
          <ng-template #empty>
            <div class="text-sm text-muted-foreground text-center py-12">Keine Haushalte</div>
          </ng-template>
        </klar-virtual-list>
      </div>
    </div>
  `,
})
export class AdminHouseholdsTabComponent {
  private api = inject(AdminApiService);

  protected readonly rowH = 52;

  protected readonly query = signal('');
  protected readonly all = signal<AdminHousehold[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    if (!q) return this.all();
    return this.all().filter(
      (h) =>
        h.name.toLowerCase().includes(q) ||
        h.members.some((m) => m.email.toLowerCase().includes(q)),
    );
  });

  protected readonly header = computed(() => `Haushalte (${this.all().length})`);

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const data = await this.api.listHouseholds();
      this.all.set(data);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Fehler beim Laden');
    } finally {
      this.loading.set(false);
    }
  }

  protected formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }
}
