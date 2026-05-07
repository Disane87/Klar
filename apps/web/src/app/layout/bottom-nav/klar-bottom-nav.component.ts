import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { KlarIconComponent } from '../../shared/icons/klar-icon.component';

interface BottomTab {
  readonly id: string;
  readonly label: string;
  readonly icon: string;
  readonly route: string;
}

const BOTTOM_TABS: readonly BottomTab[] = [
  { id: 'fixkosten', label: 'Fixkosten', icon: 'wallet',   route: '/app/fixkosten' },
  { id: 'monat',     label: 'Cashflow',  icon: 'calendar', route: '/app/monat' },
  { id: 'projekte',  label: 'Projekte',  icon: 'folder',   route: '/app/projekte' },
  { id: 'mehr',      label: 'Mehr',      icon: 'menu',     route: '/app/mehr' },
];

@Component({
  selector: 'klar-bottom-nav',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, KlarIconComponent],
  host: {
    class:
      'fixed inset-x-0 bottom-0 z-100 flex md:hidden ' +
      'h-(--bottomnav-h) pb-(--safe-bottom) ' +
      'border-t border-(--line) bg-(--bg-1)',
  },
  template: `
    @for (tab of tabs; track tab.id) {
      <a
        [routerLink]="tab.route"
        routerLinkActive="is-active"
        class="
          group relative flex-1
          flex flex-col items-center justify-center gap-0.5
          min-h-11
          text-(--fg-2) [&.is-active]:text-(--accent)
          tracking-[0.04em] no-underline
          transition-colors duration-150
          before:absolute before:top-0 before:left-1/4 before:right-1/4 before:h-0.5
          before:rounded-b-xs before:bg-(--accent)
          before:opacity-0 [&.is-active]:before:opacity-100
        "
      >
        <klar-icon [name]="tab.icon" [size]="18" />
        <span class="text-[10px] leading-none">{{ tab.label }}</span>
      </a>
    }
  `,
})
export class KlarBottomNavComponent {
  protected readonly tabs = BOTTOM_TABS;
}
