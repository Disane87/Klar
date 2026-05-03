import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HlmButtonDirective } from '../../shared/ui/hlm/hlm-button.directive';
import { HlmInputDirective } from '../../shared/ui/hlm/hlm-input.directive';
import { HlmLabelDirective } from '../../shared/ui/hlm/hlm-label.directive';
import { HlmSpinnerComponent } from '../../shared/ui/hlm/hlm-spinner.component';
import { HlmBadgeDirective } from '../../shared/ui/hlm/hlm-badge.directive';
import { KlarDialogService } from '../../shared/ui/klar-dialog.service';
import { KlarToastService } from '../../shared/ui/klar-toast.service';
import { KlarIconComponent } from '../../shared/icons/klar-icon.component';
import { KlarSkeletonRowsComponent } from '../../shared/ui/klar-skeleton-rows.component';
import { UserSettingsStore } from '../../core/user/user-settings.store';
import { HouseholdStore } from '../../core/household/household.store';
import { ThemeService, type Theme } from '../../core/theme/theme.service';
import { PageHeaderService } from '../../core/page-header/page-header.service';
import { ChangePasswordDialogComponent } from './change-password-dialog.component';
import { DeleteAccountDialogComponent } from './delete-account-dialog.component';

@Component({
  selector: 'app-settings',
  standalone: true,
  host: { class: 'flex flex-col flex-1 min-h-0 overflow-hidden' },
  imports: [
    DatePipe,
    FormsModule,
    RouterLink,
    HlmButtonDirective,
    HlmInputDirective,
    HlmLabelDirective,
    HlmSpinnerComponent,
    HlmBadgeDirective,
    KlarIconComponent,
    KlarSkeletonRowsComponent,
  ],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css',
})
export class SettingsPageComponent {
  protected store = inject(UserSettingsStore);
  protected hhStore = inject(HouseholdStore);
  protected themeService = inject(ThemeService);
  private dialog = inject(KlarDialogService);
  private toast = inject(KlarToastService);

  readonly editingProfile = signal(false);
  readonly editDisplayName = signal('');
  readonly savingProfile = signal(false);

  readonly initials = computed(() => {
    const name = this.store.profile()?.displayName ?? '';
    return name.slice(0, 2).toUpperCase();
  });

  readonly currentSessions = computed(() =>
    this.store.sessions().filter(s => s.isCurrent),
  );
  readonly otherSessions = computed(() =>
    this.store.sessions().filter(s => !s.isCurrent),
  );

  constructor() {
    inject(PageHeaderService).set({
      title: 'Einstellungen',
      subtitle: 'PROFIL & APP',
    });
  }

  async ngOnInit(): Promise<void> {
    await Promise.all([
      this.store.loadProfile(),
      this.store.loadSessions(),
    ]).catch(() => {
      this.toast.error('Einstellungen konnten nicht geladen werden');
    });
  }

  startEditProfile(): void {
    this.editDisplayName.set(this.store.profile()?.displayName ?? '');
    this.editingProfile.set(true);
  }

  cancelEditProfile(): void {
    this.editingProfile.set(false);
  }

  async saveProfile(): Promise<void> {
    this.savingProfile.set(true);
    try {
      await this.store.updateProfile({
        displayName: this.editDisplayName(),
      });
      this.editingProfile.set(false);
      this.toast.success('Profil gespeichert');
    } catch {
      this.toast.error('Profil konnte nicht gespeichert werden');
    } finally {
      this.savingProfile.set(false);
    }
  }

  setTheme(theme: Theme): void {
    this.themeService.set(theme);
  }

  openChangePassword(): void {
    this.dialog.open({ title: 'Passwort ändern', component: ChangePasswordDialogComponent, width: 'sm' });
  }

  openDeleteAccount(): void {
    this.dialog.open({
      title: 'Konto löschen',
      component: DeleteAccountDialogComponent,
      width: 'sm',
      disableBackdropClose: true,
    });
  }

  async revokeSession(tokenId: string): Promise<void> {
    try {
      await this.store.revokeSession(tokenId);
      this.toast.success('Sitzung widerrufen');
    } catch {
      this.toast.error('Sitzung konnte nicht widerrufen werden');
    }
  }

  async revokeAllSessions(): Promise<void> {
    try {
      await this.store.revokeAllSessions();
      this.toast.success('Alle anderen Sitzungen widerrufen');
    } catch {
      this.toast.error('Sitzungen konnten nicht widerrufen werden');
    }
  }

  async unlinkOidc(identityId: string): Promise<void> {
    try {
      await this.store.unlinkOidc(identityId);
      this.toast.success('Konto getrennt');
    } catch {
      this.toast.error('Konto konnte nicht getrennt werden');
    }
  }

  formatRelativeTime(isoString: string): string {
    const diff = Date.now() - new Date(isoString).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 2) return 'gerade eben';
    if (minutes < 60) return `vor ${minutes} Minuten`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `vor ${hours} Stunden`;
    const days = Math.floor(hours / 24);
    return `vor ${days} Tagen`;
  }
}