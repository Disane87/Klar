import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BrnPopoverImports } from '@spartan-ng/brain/popover';
import { KlarIconComponent } from '../icons/klar-icon.component';
import { AuthStore } from '../../core/auth/auth.store';
import { HouseholdStore } from '../../core/household/household.store';

@Component({
  selector: 'klar-header-user',
  standalone: true,
  imports: [BrnPopoverImports, RouterLink, KlarIconComponent],
  template: `
    <div class="flex items-center gap-1.5">

      @if (householdStore.activeHousehold(); as hh) {
        <brn-popover align="end" [sideOffset]="8">
          <button brnPopoverTrigger type="button"
                  class="flex size-6.5 items-center justify-center rounded-sm
                         font-mono text-[10px] font-semibold text-accent
                         transition-opacity hover:opacity-80
                         bg-[color-mix(in_oklab,var(--color-accent)_12%,var(--surface-2))]
                         border border-[color-mix(in_oklab,var(--color-accent)_35%,transparent)]"
                  [title]="hh.household.name">
            {{ hh.household.name.slice(0, 2).toUpperCase() }}
          </button>
          <ng-template brnPopoverContent>
            <div class="min-w-50 rounded-md border border-(--border) bg-(--surface) py-1 shadow-[0_8px_30px_rgba(0,0,0,0.35)]">
              <div class="px-3 py-2.5 border-b border-(--border)">
                <div class="text-[13px] font-medium text-(--text)">{{ hh.household.name }}</div>
                <div class="mt-0.5 text-[9px] uppercase tracking-widest text-(--text-muted)">{{ hh.role }}</div>
              </div>
              <a routerLink="/app/haushalt"
                 class="flex items-center gap-2 px-3 py-2 text-[11px] uppercase tracking-[0.08em] font-medium
                        text-(--text-2) no-underline transition-colors
                        hover:bg-(--surface-2) hover:text-(--text)">
                <klar-icon name="haushalt" [size]="12" />
                Haushalt verwalten
              </a>
            </div>
          </ng-template>
        </brn-popover>
      }

      @if (authStore.user(); as user) {
        <brn-popover align="end" [sideOffset]="8">
          <button brnPopoverTrigger type="button"
                  class="flex size-6.5 items-center justify-center rounded-full
                         font-mono text-[10px] font-bold text-surplus
                         transition-opacity hover:opacity-80
                         bg-[color-mix(in_oklab,var(--color-surplus)_14%,var(--surface-2))]
                         border border-[color-mix(in_oklab,var(--color-surplus)_40%,transparent)]"
                  [title]="user.displayName">
            {{ initials() }}
          </button>
          <ng-template brnPopoverContent>
            <div class="min-w-50 rounded-md border border-(--border) bg-(--surface) py-1 shadow-[0_8px_30px_rgba(0,0,0,0.35)]">
              <div class="px-3 py-2.5 border-b border-(--border)">
                <div class="text-[13px] font-medium text-(--text)">{{ user.displayName }}</div>
                <div class="mt-0.5 text-[11px] text-(--text-muted) truncate">{{ user.email }}</div>
              </div>
              <a routerLink="/app/settings"
                 class="flex items-center gap-2 px-3 py-2 text-[11px] uppercase tracking-[0.08em] font-medium
                        text-(--text-2) no-underline transition-colors
                        hover:bg-(--surface-2) hover:text-(--text)">
                <klar-icon name="settings" [size]="12" />
                Einstellungen
              </a>
              <div class="h-px bg-(--border) mx-1 my-1"></div>
              <button type="button" (click)="authStore.logout()"
                      class="flex w-full items-center gap-2 px-3 py-2 text-[11px] uppercase tracking-[0.08em] font-medium
                             text-(--color-expense) transition-colors hover:bg-(--surface-2) cursor-pointer">
                <klar-icon name="logout" [size]="12" />
                Abmelden
              </button>
            </div>
          </ng-template>
        </brn-popover>
      }

    </div>
  `,
})
export class KlarHeaderUserComponent {
  protected householdStore = inject(HouseholdStore);
  protected authStore      = inject(AuthStore);

  protected initials = computed(() => {
    const name = this.authStore.user()?.displayName ?? '';
    return name.split(' ').map(p => p[0] ?? '').join('').slice(0, 2).toUpperCase() || '?';
  });
}
