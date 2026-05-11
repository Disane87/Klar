import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { KlarHeaderUserComponent } from '../../shared/ui/klar-header-user.component';
import { KlarNotificationBellComponent } from '../notification-bell/notification-bell.component';
import { PageHeaderService } from '../../core/page-header/page-header.service';
import { OverviewStore } from '../../core/overview/overview.store';

@Component({
  selector: 'klar-mobile-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [KlarHeaderUserComponent, KlarNotificationBellComponent],
  host: {
    class:
      'flex md:hidden sticky top-0 z-5 shrink-0 ' +
      'h-[calc(var(--header-h)+var(--safe-top))] pt-(--safe-top) px-4 ' +
      'border-b border-(--line) bg-(--bg) ' +
      'items-center justify-between',
  },
  template: `
    <div class="flex flex-col min-w-0">
      <span class="text-[11px] tracking-[0.04em] text-(--fg-2) truncate">
        {{ chip() }}
      </span>
      <span
        class="text-[18px] leading-none truncate font-medium"
        style="font-family: var(--font-display); letter-spacing: -0.02em;"
      >{{ pageHeader.title() }}</span>
    </div>
    <div class="flex items-center gap-1">
      <klar-notification-bell />
      <klar-header-user />
    </div>
  `,
})
export class KlarMobileHeaderComponent {
  protected readonly pageHeader = inject(PageHeaderService);
  private readonly overviewStore = inject(OverviewStore);

  private readonly monthChip = computed(() => {
    const [year, month] = this.overviewStore.currentMonth().split('-');
    return new Date(Number(year), Number(month) - 1, 1)
      .toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
  });

  protected readonly chip = computed(() => this.pageHeader.chipLabel() ?? this.monthChip());
}
