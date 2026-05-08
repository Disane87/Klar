import { ChangeDetectionStrategy, Component, computed, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PageHeaderService } from '../../core/page-header/page-header.service';
import { AuthStore } from '../../core/auth/auth.store';
import { KlarIconComponent } from '../../shared/icons/klar-icon.component';
import { KlarSectionHeaderComponent } from '../../shared/ui/klar-section-header.component';
import { mehrPageItems, type NavItem } from '../../core/navigation/nav-items';

interface MehrGroup {
  readonly label: string;
  readonly items: readonly NavItem[];
}

const SECTION_LABEL: Record<NavItem['section'], string> = {
  main:   'Haushalt',
  system: 'System',
};

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
    const grouped = mehrPageItems({ isAdmin });
    return [
      { label: SECTION_LABEL.main,   items: grouped.main },
      { label: SECTION_LABEL.system, items: grouped.system },
    ].filter(group => group.items.length > 0);
  });

  ngOnInit(): void {
    this.pageHeader.set({ title: 'Mehr', subtitle: 'Weitere Bereiche' });
  }
}
