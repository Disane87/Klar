import { Component, computed, inject, signal, viewChild, ElementRef } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { BrnPopoverImports } from '@spartan-ng/brain/popover';
import { KlarIconComponent } from '../icons/klar-icon.component';
import { AuthStore } from '../../core/auth/auth.store';
import { AuthService } from '../../core/auth/auth.service';
import { HouseholdStore } from '../../core/household/household.store';

@Component({
  selector: 'klar-header-user',
  standalone: true,
  imports: [BrnPopoverImports, RouterLink, KlarIconComponent],
  template: `
    <brn-popover align="end" [sideOffset]="8">

      <!-- Trigger: 32px flat-initials or photo -->
      <button brnPopoverTrigger type="button"
              class="flex size-8 items-center justify-center rounded-full overflow-hidden
                     transition-opacity hover:opacity-80 active:opacity-60
                     border border-[color-mix(in_oklab,var(--color-accent)_35%,transparent)]
                     bg-[color-mix(in_oklab,var(--color-accent)_10%,var(--surface-2))]"
              [title]="authStore.user()?.displayName ?? ''">
        @if (authStore.user()?.avatarUrl) {
          <img [src]="authStore.user()!.avatarUrl!"
               class="size-8 object-cover" alt="Avatar" />
        } @else {
          <span class="font-mono text-[11px] font-semibold text-(--color-accent)">
            {{ initials() }}
          </span>
        }
      </button>

      <ng-template brnPopoverContent>
        <div class="min-w-56 rounded-lg border border-(--border) bg-(--surface) py-1
                    shadow-[0_8px_30px_rgba(0,0,0,0.35)]">

          <!-- User section -->
          @if (authStore.user(); as user) {
            <div class="px-3 py-3 border-b border-(--border)">
              <div class="flex items-center gap-3">

                <!-- 40px avatar with upload overlay -->
                <button type="button"
                        class="relative size-10 rounded-full shrink-0 overflow-hidden
                               border border-[color-mix(in_oklab,var(--color-accent)_35%,transparent)]
                               bg-[color-mix(in_oklab,var(--color-accent)_10%,var(--surface-2))]
                               group cursor-pointer"
                        (click)="triggerFileInput()"
                        [disabled]="uploading()"
                        title="Foto ändern">
                  @if (user.avatarUrl) {
                    <img [src]="user.avatarUrl" class="size-10 object-cover" alt="Avatar" />
                  } @else {
                    <span class="font-mono text-[13px] font-semibold text-(--color-accent)">
                      {{ initials() }}
                    </span>
                  }
                  <!-- Hover overlay -->
                  <div class="absolute inset-0 bg-black/50 flex items-center justify-center
                               opacity-0 group-hover:opacity-100 transition-opacity">
                    @if (uploading()) {
                      <div class="size-3 border border-white/50 border-t-white rounded-full animate-spin"></div>
                    } @else {
                      <!-- Camera icon (inline SVG — no camera icon in klar-icon system) -->
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white"
                           stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                        <circle cx="12" cy="13" r="4"/>
                      </svg>
                    }
                  </div>
                </button>

                <div class="min-w-0 flex-1">
                  <div class="text-[13px] font-medium text-(--text) truncate">{{ user.displayName }}</div>
                  <div class="mt-0.5 text-[11px] text-(--text-muted) truncate">{{ user.email }}</div>
                  <button type="button" (click)="triggerFileInput()"
                          [disabled]="uploading()"
                          class="mt-1 text-[10px] uppercase tracking-[0.08em] font-medium
                                 text-(--color-accent) cursor-pointer hover:underline">
                    Foto ändern
                  </button>
                </div>
              </div>
            </div>
          }

          <!-- Hidden file input — outside @if so viewChild always resolves -->
          <input #fileInput type="file" accept="image/jpeg,image/png,image/webp,image/gif"
                 class="hidden" (change)="onFileSelected($event)" />

          <!-- Household section -->
          @if (householdStore.activeHousehold(); as hh) {
            <div class="px-3 py-2.5 border-b border-(--border)">
              <div class="text-[9px] uppercase tracking-[0.12em] text-(--text-muted) font-medium mb-2">
                Haushalt
              </div>
              <div class="flex items-center gap-2">
                <div class="flex size-5 items-center justify-center rounded shrink-0
                            font-mono text-[8px] font-bold text-(--color-expense)
                            bg-[color-mix(in_oklab,var(--color-expense)_12%,var(--surface-2))]
                            border border-[color-mix(in_oklab,var(--color-expense)_30%,transparent)]">
                  {{ hh.household.name.slice(0, 2).toUpperCase() }}
                </div>
                <span class="text-[12px] text-(--text-2) truncate flex-1">{{ hh.household.name }}</span>
                <span class="text-[9px] uppercase tracking-[0.08em] text-(--text-muted)">{{ hh.role }}</span>
              </div>
              <a routerLink="/app/haushalt"
                 class="mt-1.5 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.08em]
                        font-medium text-(--text-muted) no-underline hover:text-(--text) transition-colors">
                <klar-icon name="haushalt" [size]="10" />
                Haushalt verwalten
              </a>
            </div>
          }

          <!-- Actions -->
          <div class="py-1">
            <a routerLink="/app/settings"
               class="flex items-center gap-2 px-3 py-2 text-[11px] uppercase tracking-[0.08em]
                      font-medium text-(--text-2) no-underline transition-colors
                      hover:bg-(--surface-2) hover:text-(--text)">
              <klar-icon name="settings" [size]="12" />
              Einstellungen
            </a>
            <div class="h-px bg-(--border) mx-2 my-1"></div>
            <button type="button" (click)="authStore.logout()"
                    class="flex w-full items-center gap-2 px-3 py-2 text-[11px] uppercase
                           tracking-[0.08em] font-medium text-(--color-expense)
                           transition-colors hover:bg-(--surface-2) cursor-pointer">
              <klar-icon name="logout" [size]="12" />
              Abmelden
            </button>
          </div>

        </div>
      </ng-template>
    </brn-popover>
  `,
})
export class KlarHeaderUserComponent {
  protected householdStore = inject(HouseholdStore);
  protected authStore      = inject(AuthStore);
  private   authService    = inject(AuthService);

  protected uploading = signal(false);
  private fileInputRef = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  protected initials = computed(() => {
    const name = this.authStore.user()?.displayName ?? '';
    return name.split(' ').map(p => p[0] ?? '').join('').slice(0, 2).toUpperCase() || '?';
  });

  protected triggerFileInput(): void {
    this.fileInputRef()?.nativeElement.click();
  }

  protected async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.uploading.set(true);
    try {
      const { avatarUrl } = await firstValueFrom(this.authService.uploadAvatar(file));
      this.authStore.updateAvatar(avatarUrl);
    } catch {
      // Toast handled by ErrorInterceptor
    } finally {
      this.uploading.set(false);
      input.value = '';
    }
  }
}
