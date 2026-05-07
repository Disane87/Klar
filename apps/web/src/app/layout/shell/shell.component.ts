import { Component, computed, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SideNavComponent } from '../side-nav/side-nav.component';
import { TopBarComponent } from '../top-bar/top-bar.component';
import { KlarToastContainerComponent } from '../../shared/ui/klar-toast.component';
import { KlarBottomNavComponent } from '../bottom-nav/klar-bottom-nav.component';
import { KlarMobileHeaderComponent } from '../mobile-header/klar-mobile-header.component';
import { PageHeaderService } from '../../core/page-header/page-header.service';
import { OverviewStore } from '../../core/overview/overview.store';
import { UpdateBannerComponent } from '../../core/version/update-banner.component';

@Component({
  selector: 'klar-shell',
  standalone: true,
  imports: [
    RouterOutlet,
    SideNavComponent,
    TopBarComponent,
    KlarToastContainerComponent,
    KlarBottomNavComponent,
    KlarMobileHeaderComponent,
    UpdateBannerComponent,
  ],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.css',
})
export class ShellComponent {
  protected pageHeader = inject(PageHeaderService);
  private overviewStore = inject(OverviewStore);

  protected monthChip = computed(() => {
    const [year, month] = this.overviewStore.currentMonth().split('-');
    return new Date(Number(year), Number(month) - 1, 1)
      .toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
  });
}
