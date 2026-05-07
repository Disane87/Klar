import { Component, computed, inject } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { SideNavComponent } from '../side-nav/side-nav.component';
import { TopBarComponent } from '../top-bar/top-bar.component';
import { KlarIconComponent } from '../../shared/icons/klar-icon.component';
import { KlarToastContainerComponent } from '../../shared/ui/klar-toast.component';
import { KlarHeaderUserComponent } from '../../shared/ui/klar-header-user.component';
import { KlarNotificationBellComponent } from '../notification-bell/notification-bell.component';
import { KlarModeToolbarComponent } from '../mode-toolbar/mode-toolbar.component';
import { PageHeaderService } from '../../core/page-header/page-header.service';
import { OverviewStore } from '../../core/overview/overview.store';
import { UpdateBannerComponent } from '../../core/version/update-banner.component';

interface BottomTab {
  id: string;
  label: string;
  icon: string;
  route: string;
  primary?: boolean;
}

const BOTTOM_TABS: BottomTab[] = [
  { id: 'monat',     label: 'Monat',     icon: 'trending',  route: '/app/monat' },
  { id: 'fixkosten', label: 'Fixkosten', icon: 'fixkosten', route: '/app/fixkosten' },
  { id: 'buchen',    label: 'Buchen',    icon: 'plus',      route: '/app/buchungen', primary: true },
  { id: 'projekte',  label: 'Projekte',  icon: 'folder',    route: '/app/projekte' },
  { id: 'tresor',    label: 'Tresor',    icon: 'tresor',    route: '/app/tresor' },
];

@Component({
  selector: 'klar-shell',
  standalone: true,
  imports: [
    RouterOutlet, RouterLink, RouterLinkActive,
    SideNavComponent, TopBarComponent, KlarIconComponent,
    KlarToastContainerComponent, KlarHeaderUserComponent,
    KlarNotificationBellComponent,
    KlarModeToolbarComponent,
    UpdateBannerComponent,
  ],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.css',
})
export class ShellComponent {
  protected tabs        = BOTTOM_TABS;
  protected pageHeader  = inject(PageHeaderService);
  private   overviewStore = inject(OverviewStore);

  protected monthChip = computed(() => {
    const [year, month] = this.overviewStore.currentMonth().split('-');
    return new Date(Number(year), Number(month) - 1, 1)
      .toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
  });
}
