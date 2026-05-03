import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { KlarIconComponent } from '../../shared/icons/klar-icon.component';
import { KlarWordmarkComponent } from '../../shared/brand/klar-wordmark.component';

interface NavItem {
  id: string;
  label: string;
  icon: string;
  route: string;
}

const MAIN_ITEMS: NavItem[] = [
  { id: 'fixkosten', label: 'Fixkosten',     icon: 'fixkosten',     route: '/app/fixkosten' },
  { id: 'monat',     label: 'Monat',         icon: 'trending',      route: '/app/monat' },
  { id: 'projekte',  label: 'Projekte',      icon: 'folder',        route: '/app/projekte' },
  { id: 'buchungen', label: 'Buchungen',     icon: 'receipt',       route: '/app/buchungen' },
];

const SYS_ITEMS: NavItem[] = [
  { id: 'haushalt', label: 'Haushalt',   icon: 'haushalt', route: '/app/haushalt' },
  { id: 'tresor',   label: 'Tresor',      icon: 'tresor',   route: '/app/tresor' },
  { id: 'settings', label: 'Einstellungen',  icon: 'settings', route: '/app/settings' },
];

@Component({
  selector: 'klar-side-nav',
  standalone: true,
  host: { class: 'contents' },
  imports: [RouterLink, RouterLinkActive, KlarIconComponent, KlarWordmarkComponent],
  templateUrl: './side-nav.component.html',
  styleUrl: './side-nav.component.css',
})
export class SideNavComponent {
  protected mainItems = MAIN_ITEMS;
  protected sysItems  = SYS_ITEMS;
}
