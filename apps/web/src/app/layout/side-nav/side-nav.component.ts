import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { KlarIconComponent } from '../../shared/icons/klar-icon.component';
import { KlarHeaderUserComponent } from '../../shared/ui/klar-header-user.component';
import { KlarSelectComponent, type KlarSelectOption } from '../../shared/ui/klar-select.component';
import { AuthStore } from '../../core/auth/auth.store';
import { HouseholdStore } from '../../core/household/household.store';

interface NavItem {
  id: string;
  label: string;
  icon: string;
  route: string;
  /** Category tone CSS var that paints the active-state border, glow, and icon hover. */
  tone: string;
}

// Tone mapping is taken verbatim from the Klar Design Pearl bundle (klar/project/app.jsx).
const MAIN_ITEMS: NavItem[] = [
  { id: 'fixkosten', label: 'Fixkosten',  icon: 'fixkosten', route: '/app/fixkosten', tone: 'var(--cat-abos)' },
  { id: 'monat',     label: 'Cashflow',   icon: 'trending',  route: '/app/monat',     tone: 'var(--cat-essen)' },
  { id: 'kalender',  label: 'Kalender',   icon: 'planspiel', route: '/app/kalender',  tone: 'var(--cat-mobil)' },
  { id: 'statistik', label: 'Statistik',  icon: 'trending',  route: '/app/statistik', tone: 'var(--cat-freizeit)' },
  { id: 'buchungen', label: 'Buchungen',  icon: 'receipt',   route: '/app/buchungen', tone: 'var(--cat-mobil)' },
  { id: 'projekte',  label: 'Projekte',   icon: 'folder',    route: '/app/projekte',  tone: 'var(--cat-freizeit)' },
  { id: 'vertraege', label: 'Verträge',   icon: 'shield',    route: '/app/vertraege', tone: 'var(--cat-versicher)' },
  { id: 'import',    label: 'CSV-Import', icon: 'arrow-up',  route: '/app/import',    tone: 'var(--cat-gesund)' },
];

const SYS_ITEMS: NavItem[] = [
  { id: 'haushalt', label: 'Haushalt',      icon: 'haushalt', route: '/app/haushalt', tone: 'var(--cat-essen)' },
  { id: 'tresor',   label: 'Tresor',        icon: 'tresor',   route: '/app/tresor',   tone: 'var(--cat-versicher)' },
  { id: 'settings', label: 'Einstellungen', icon: 'settings', route: '/app/settings', tone: 'var(--cat-spar)' },
  { id: 'health',   label: 'System',        icon: 'pulse',    route: '/app/health',   tone: 'var(--cat-wohnen)' },
];

const ADMIN_ITEM:    NavItem = { id: 'admin', label: 'Admin',         icon: 'shield',       route: '/app/admin', tone: 'var(--cat-mobil)' };
// /app/spec and /app/crud are design-reference pages (controls + dialog patterns).
// Routes stay reachable via direct URL but they don't belong in the sidebar nav.

@Component({
  selector: 'klar-side-nav',
  standalone: true,
  host: { class: 'contents' },
  imports: [RouterLink, RouterLinkActive, KlarIconComponent, KlarHeaderUserComponent, KlarSelectComponent],
  templateUrl: './side-nav.component.html',
  styleUrl: './side-nav.component.css',
})
export class SideNavComponent {
  private auth = inject(AuthStore);
  protected householdStore = inject(HouseholdStore);

  protected mainItems = MAIN_ITEMS;
  protected sysItems = computed<NavItem[]>(() =>
    this.auth.user()?.appRole === 'ADMIN' ? [...SYS_ITEMS, ADMIN_ITEM] : SYS_ITEMS,
  );

  protected showSwitcher = computed(() => this.householdStore.households().length > 1);

  protected householdOptions = computed<KlarSelectOption[]>(() =>
    this.householdStore.households().map(h => ({
      value: h.household.id,
      label: h.household.name,
    })),
  );

  protected activeHouseholdId = computed(() => this.householdStore.activeId() ?? '');

  protected onHouseholdChange(id: string): void {
    if (!id || id === this.householdStore.activeId()) return;
    this.householdStore.setActiveHousehold(id);
    // Hard reload so every domain store pulls data for the new household context.
    if (typeof window !== 'undefined') window.location.reload();
  }
}
