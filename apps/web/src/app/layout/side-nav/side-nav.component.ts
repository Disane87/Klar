import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { KlarIconComponent } from '../../shared/icons/klar-icon.component';
import { KlarHeaderUserComponent } from '../../shared/ui/klar-header-user.component';
import { KlarSelectComponent, type KlarSelectOption } from '../../shared/ui/klar-select.component';
import { AuthStore } from '../../core/auth/auth.store';
import { HouseholdStore } from '../../core/household/household.store';
import { VersionService } from '../../core/version/version.service';
import { sideNavItems, type NavItem } from '../../core/navigation/nav-items';

// /app/spec and /app/crud are design-reference pages (controls + dialog patterns).
// Routes stay reachable via direct URL but they don't belong in any nav.
export type { NavItem };

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
  protected version = inject(VersionService);

  private readonly groups = computed(() =>
    sideNavItems({ isAdmin: this.auth.user()?.appRole === 'ADMIN' }),
  );
  protected mainItems = computed<NavItem[]>(() => this.groups().main);
  protected sysItems = computed<NavItem[]>(() => this.groups().system);

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
