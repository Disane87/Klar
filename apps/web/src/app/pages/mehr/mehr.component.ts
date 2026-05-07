import { ChangeDetectionStrategy, Component, computed, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PageHeaderService } from '../../core/page-header/page-header.service';
import { AuthStore } from '../../core/auth/auth.store';
import { KlarIconComponent } from '../../shared/icons/klar-icon.component';
import { KlarSectionHeaderComponent } from '../../shared/ui/klar-section-header.component';

interface MehrItem {
  readonly id: string;
  readonly label: string;
  readonly icon: string;
  readonly route: string;
  readonly tone: string;
  readonly adminOnly?: boolean;
}

interface MehrGroup {
  readonly label: string;
  readonly items: readonly MehrItem[];
}

const GROUPS: readonly MehrGroup[] = [
  {
    label: 'Haushalt',
    items: [
      { id: 'kalender',  label: 'Kalender',     icon: 'calendar',     route: '/app/kalender',  tone: 'var(--cat-mobil)' },
      { id: 'statistik', label: 'Statistik',    icon: 'trending',     route: '/app/statistik', tone: 'var(--cat-freizeit)' },
      { id: 'vertraege', label: 'Verträge',     icon: 'shield',       route: '/app/vertraege', tone: 'var(--cat-versicher)' },
      { id: 'recurring', label: 'Daueraufträge', icon: 'wiederkehrend', route: '/app/buchungen', tone: 'var(--cat-versicher)' },
      { id: 'planspiel', label: 'Planspiel',    icon: 'planspiel',    route: '/app/planspiel', tone: 'var(--cat-abos)' },
      { id: 'tresor',    label: 'Tresor',       icon: 'tresor',       route: '/app/tresor',    tone: 'var(--cat-spar)' },
      { id: 'import',    label: 'CSV-Import',   icon: 'receipt',      route: '/app/import',    tone: 'var(--cat-gesund)' },
    ],
  },
  {
    label: 'System',
    items: [
      { id: 'haushalt', label: 'Haushalt',      icon: 'haushalt', route: '/app/haushalt', tone: 'var(--cat-essen)' },
      { id: 'settings', label: 'Einstellungen', icon: 'settings', route: '/app/settings', tone: 'var(--cat-spar)' },
      { id: 'health',   label: 'System-Status', icon: 'pulse',    route: '/app/health',   tone: 'var(--cat-wohnen)' },
      { id: 'admin',    label: 'Admin',         icon: 'shield',   route: '/app/admin',    tone: 'var(--cat-mobil)', adminOnly: true },
    ],
  },
];

@Component({
  selector: 'klar-mehr-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, KlarIconComponent, KlarSectionHeaderComponent],
  host: { class: 'block px-4 pt-4 pb-(--bottomnav-h)' },
  template: `
    @for (group of visibleGroups(); track group.label) {
      <section class="mb-6">
        <klar-section-header [title]="group.label" />
        <ul
          class="
            mt-2 overflow-hidden
            rounded-(--r-8) border border-(--line) bg-(--bg-1)
            divide-y divide-(--line-soft)
          "
        >
          @for (item of group.items; track item.id) {
            <li>
              <a
                [routerLink]="item.route"
                class="
                  group flex items-center gap-3
                  min-h-11 px-4 py-3
                  text-(--fg) no-underline
                  hover:bg-(--bg-2) transition-colors duration-150
                "
              >
                <span
                  class="grid place-items-center size-7 rounded-(--r-6) border border-(--line-soft) bg-(--bg-2)"
                  [style.color]="item.tone"
                >
                  <klar-icon [name]="item.icon" [size]="16" />
                </span>
                <span class="flex-1 text-[14px]">{{ item.label }}</span>
                <klar-icon name="chevron-right" [size]="16" class="text-(--fg-3)" />
              </a>
            </li>
          }
        </ul>
      </section>
    }
  `,
})
export class MehrPageComponent implements OnInit {
  private readonly pageHeader = inject(PageHeaderService);
  private readonly auth = inject(AuthStore);

  protected readonly visibleGroups = computed<readonly MehrGroup[]>(() => {
    const isAdmin = this.auth.user()?.appRole === 'ADMIN';
    return GROUPS.map(group => ({
      label: group.label,
      items: group.items.filter(item => !item.adminOnly || isAdmin),
    })).filter(group => group.items.length > 0);
  });

  ngOnInit(): void {
    this.pageHeader.set({ title: 'Mehr', subtitle: 'Weitere Bereiche' });
  }
}
