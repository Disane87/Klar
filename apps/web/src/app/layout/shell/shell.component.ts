import { Component, computed, inject } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { SideNavComponent } from '../side-nav/side-nav.component';
import { TopBarComponent } from '../top-bar/top-bar.component';
import { KlarIconComponent } from '../../shared/icons/klar-icon.component';
import { KlarToastContainerComponent } from '../../shared/ui/klar-toast.component';
import { HouseholdStore } from '../../core/household/household.store';
import { PageHeaderService } from '../../core/page-header/page-header.service';
import { OverviewStore } from '../../core/overview/overview.store';

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
  { id: 'mehr',      label: 'Mehr',      icon: 'haushalt',  route: '/app/haushalt' },
];

@Component({
  selector: 'klar-shell',
  standalone: true,
  imports: [
    RouterOutlet, RouterLink, RouterLinkActive,
    SideNavComponent, TopBarComponent, KlarIconComponent, KlarToastContainerComponent,
  ],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.css',
})
export class ShellComponent {
  protected tabs            = BOTTOM_TABS;
  protected householdStore  = inject(HouseholdStore);
  protected pageHeader      = inject(PageHeaderService);
  private   overviewStore   = inject(OverviewStore);

  protected monthChip = computed(() => {
    const [year, month] = this.overviewStore.currentMonth().split('-');
    return new Date(Number(year), Number(month) - 1, 1)
      .toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
  });
}
