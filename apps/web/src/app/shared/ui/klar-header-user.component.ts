import { Component, computed, inject, signal, viewChild, ElementRef } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { BrnPopoverImports } from '@spartan-ng/brain/popover';
import { KlarIconComponent } from '../icons/klar-icon.component';
import { KlarAvatarComponent } from './klar-avatar.component';
import { KlarDialogService } from './klar-dialog.service';
import { KlarImageCropDialogComponent } from './klar-image-crop-dialog.component';
import { AuthStore } from '../../core/auth/auth.store';
import { AuthService } from '../../core/auth/auth.service';
import { HouseholdStore } from '../../core/household/household.store';

interface HelpLink {
  label: string;
  href: string;
  icon: string;
}

const REPO_URL = 'https://github.com/Disane87/Klar';

@Component({
  selector: 'klar-header-user',
  standalone: true,
  imports: [BrnPopoverImports, RouterLink, KlarIconComponent, KlarAvatarComponent],
  template: `
    <brn-popover align="end" [sideOffset]="8">

      <!-- Trigger: 32px avatar -->
      <button brnPopoverTrigger type="button"
              class="flex items-center justify-center rounded-full overflow-hidden
                     transition-opacity hover:opacity-80 active:opacity-60"
              [title]="authStore.user()?.displayName ?? ''">
        <klar-avatar [avatarUrl]="authStore.user()?.avatarUrl"
                     [seed]="authStore.user()?.displayName ?? ''"
                     [initials]="initials()"
                     [size]="32" />
      </button>

      <ng-template brnPopoverContent>
        <div class="w-72 rounded-xl border border-(--border) bg-(--surface) p-1.5
                    shadow-[0_12px_40px_rgba(0,0,0,0.45)]">

          <!-- User section -->
          @if (authStore.user(); as user) {
            <div class="flex items-center gap-3 px-2.5 py-3">

              <!-- 44px avatar with upload overlay -->
              <button type="button"
                      class="relative size-11 shrink-0 rounded-full overflow-hidden block p-0
                             group cursor-pointer transition bg-(--surface-2)"
                      (click)="triggerFileInput()"
                      [disabled]="uploading()"
                      title="Foto ändern">
                @if (user.avatarUrl) {
                  <img [src]="user.avatarUrl" alt=""
                       class="absolute inset-0 size-full object-cover" />
                } @else {
                  <div class="absolute inset-0 flex items-center justify-center
                              text-white text-[15px] font-semibold"
                       [style.background-color]="avatarBg()">
                    {{ initials() }}
                  </div>
                }
                <div class="absolute inset-0 bg-black/55 flex items-center justify-center
                             opacity-0 group-hover:opacity-100 transition-opacity">
                  @if (uploading()) {
                    <div class="size-3.5 border border-white/40 border-t-white rounded-full animate-spin"></div>
                  } @else {
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white"
                         stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                      <circle cx="12" cy="13" r="4"/>
                    </svg>
                  }
                </div>
              </button>

              <div class="min-w-0 flex-1">
                <div class="text-[14px] font-semibold text-(--text) truncate leading-tight">{{ user.displayName }}</div>
                <div class="mt-0.5 text-[12px] text-(--text-muted) truncate leading-tight">{{ user.email }}</div>
                <button type="button" (click)="triggerFileInput()"
                        [disabled]="uploading()"
                        class="mt-1.5 text-[11px] font-medium text-(--text-muted)
                               cursor-pointer hover:text-accent transition-colors">
                  Foto ändern
                </button>
              </div>
            </div>
          }

          <!-- Hidden file input — outside @if so viewChild always resolves -->
          <input #fileInput type="file" accept="image/jpeg,image/png,image/webp,image/gif"
                 class="hidden" (change)="onFileSelected($event)" />

          <!-- Household section -->
          @if (householdStore.activeHousehold(); as hh) {
            <div class="my-1 h-px bg-(--border)"></div>
            <a routerLink="/app/haushalt"
               class="flex items-center gap-2.5 px-2.5 py-2 rounded-lg no-underline
                      text-(--text-2) transition-colors hover:bg-(--surface-2) hover:text-(--text) group">
              <div class="flex size-7 items-center justify-center rounded-md shrink-0
                          font-mono text-[10px] font-semibold text-(--text-2)
                          bg-(--surface-2) border border-(--border)">
                {{ hh.household.name.slice(0, 2).toUpperCase() }}
              </div>
              <div class="min-w-0 flex-1">
                <div class="text-[13px] font-medium truncate leading-tight">{{ hh.household.name }}</div>
                <div class="mt-0.5 text-[10px] uppercase tracking-widest text-(--text-muted) leading-tight">
                  {{ hh.role }}
                </div>
              </div>
              <klar-icon name="arrow-up-right" [size]="12"
                         class="text-(--text-muted) opacity-0 group-hover:opacity-100 transition-opacity" />
            </a>
          }

          <!-- Settings -->
          <div class="my-1 h-px bg-(--border)"></div>
          <a routerLink="/app/settings"
             class="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium
                    text-(--text-2) no-underline transition-colors
                    hover:bg-(--surface-2) hover:text-(--text)">
            <klar-icon name="settings" [size]="16" class="text-(--text-muted)" />
            Einstellungen
          </a>

          <!-- Help & Community (external links) -->
          <div class="my-1 h-px bg-(--border)"></div>
          <div class="px-2.5 pt-1.5 pb-1 text-[10px] uppercase tracking-[0.12em]
                      text-(--text-muted) font-semibold">
            Hilfe & Community
          </div>
          @for (link of helpLinks; track link.href) {
            <a [href]="link.href"
               target="_blank"
               rel="noopener noreferrer"
               class="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium
                      text-(--text-2) no-underline transition-colors
                      hover:bg-(--surface-2) hover:text-(--text) group">
              <klar-icon [name]="link.icon" [size]="16" class="text-(--text-muted)" />
              <span class="flex-1">{{ link.label }}</span>
              <klar-icon name="arrow-up-right" [size]="12"
                         class="text-(--text-muted) opacity-60 group-hover:opacity-100 transition-opacity" />
            </a>
          }

          <!-- Logout -->
          <div class="my-1 h-px bg-(--border)"></div>
          <button type="button" (click)="authStore.logout()"
                  class="flex w-full items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px]
                         font-medium text-(--color-expense) cursor-pointer transition-colors
                         hover:bg-[color-mix(in_oklab,var(--color-expense)_10%,var(--surface-2))]">
            <klar-icon name="logout" [size]="16" />
            Abmelden
          </button>

        </div>
      </ng-template>
    </brn-popover>
  `,
})
export class KlarHeaderUserComponent {
  protected householdStore = inject(HouseholdStore);
  protected authStore      = inject(AuthStore);
  private   authService    = inject(AuthService);
  private   dialog         = inject(KlarDialogService);

  protected uploading = signal(false);
  private fileInputRef = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  protected readonly helpLinks: HelpLink[] = [
    { label: 'Dokumentation',  href: `${REPO_URL}#readme`,            icon: 'info' },
    { label: 'GitHub-Repo',    href: REPO_URL,                        icon: 'folder' },
    { label: 'Issues',         href: `${REPO_URL}/issues`,            icon: 'alert' },
    { label: 'Diskussionen',   href: `${REPO_URL}/discussions`,       icon: 'mail' },
  ];

  protected initials = computed(() => {
    const name = this.authStore.user()?.displayName ?? '';
    return name.split(' ').map(p => p[0] ?? '').join('').slice(0, 2).toUpperCase() || '?';
  });

  protected avatarBg = computed(() => {
    const seed = this.authStore.user()?.displayName ?? '';
    let hash = 0;
    for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) & 0xffff;
    return `hsl(${hash % 360} 42% 38%)`;
  });

  protected triggerFileInput(): void {
    this.fileInputRef()?.nativeElement.click();
  }

  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    this.dialog.open({
      title: 'Profilfoto zuschneiden',
      component: KlarImageCropDialogComponent,
      width: 'sm',
      inputs: {
        file,
        outputSize: 256,
        shape: 'circle',
        onConfirm: async (dataUrl: string) => {
          this.uploading.set(true);
          try {
            const { avatarUrl } = await firstValueFrom(
              this.authService.uploadAvatarDataUrl(dataUrl),
            );
            this.authStore.updateAvatar(avatarUrl);
          } finally {
            this.uploading.set(false);
          }
        },
      },
    });
  }
}
