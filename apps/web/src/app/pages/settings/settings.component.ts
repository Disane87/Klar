import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { KlarButtonComponent } from '../../shared/ui/klar-button.component';
import { HlmInputDirective } from '../../shared/ui/hlm/hlm-input.directive';
import { HlmLabelDirective } from '../../shared/ui/hlm/hlm-label.directive';
import { HlmToggleGroupDirective } from '../../shared/ui/hlm/hlm-toggle-group.directive';
import { HlmToggleGroupItemDirective } from '../../shared/ui/hlm/hlm-toggle-group-item.directive';
import { KlarIconComponent } from '../../shared/icons/klar-icon.component';
import { KlarDialogService } from '../../shared/ui/klar-dialog.service';
import { KlarToastService } from '../../shared/ui/klar-toast.service';
import {
  KlarListComponent,
  KlarListGroupComponent,
  KlarListItemComponent,
} from '../../shared/ui/klar-list.component';
import { UserSettingsStore } from '../../core/user/user-settings.store';
import { HouseholdStore } from '../../core/household/household.store';
import { ThemeService, type Theme } from '../../core/theme/theme.service';
import { PageHeaderService } from '../../core/page-header/page-header.service';
import { AuthService } from '../../core/auth/auth.service';
import { ChangePasswordDialogComponent } from './change-password-dialog.component';
import { DeleteAccountDialogComponent } from './delete-account-dialog.component';
import { TotpSetupDialogComponent } from './totp-setup-dialog.component';
import { DataExportComponent } from './data-export.component';
import { DataImportComponent } from './data-import.component';

@Component({
  selector: 'app-settings',
  standalone: true,
  host: { class: 'flex flex-col flex-1 min-h-0 overflow-hidden' },
  imports: [
    DatePipe,
    FormsModule,
    KlarButtonComponent,
    HlmInputDirective,
    HlmLabelDirective,
    KlarListComponent,
    KlarListGroupComponent,
    KlarListItemComponent,
    HlmToggleGroupDirective,
    HlmToggleGroupItemDirective,
    KlarIconComponent,
  ],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css',
})
export class SettingsPageComponent {
  protected store = inject(UserSettingsStore);
  protected hhStore = inject(HouseholdStore);
  protected themeService = inject(ThemeService);
  protected router = inject(Router);
  private authService = inject(AuthService);
  private dialog = inject(KlarDialogService);
  private toast = inject(KlarToastService);

  readonly editingProfile = signal(false);
  readonly editDisplayName = signal('');
  readonly savingProfile = signal(false);

  readonly currentSessions = computed(() => this.store.sessions().filter(s => s.isCurrent));
  readonly otherSessions   = computed(() => this.store.sessions().filter(s => !s.isCurrent));

  readonly themeOptions: { value: Theme; label: string }[] = [
    { value: 'light',  label: 'Hell' },
    { value: 'dark',   label: 'Dunkel' },
    { value: 'system', label: 'System' },
  ];

  constructor() {
    inject(PageHeaderService).set({ title: 'Einstellungen', subtitle: 'PROFIL & APP' });
  }

  async ngOnInit(): Promise<void> {
    await Promise.all([
      this.store.loadProfile(),
      this.store.loadSessions(),
    ]).catch(() => this.toast.error('Einstellungen konnten nicht geladen werden'));
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
      await this.store.updateProfile({ displayName: this.editDisplayName() });
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

  async disableTotp(): Promise<void> {
    try {
      await firstValueFrom(this.authService.disableTotp());
      await this.store.loadProfile();
      this.toast.success('2FA wurde deaktiviert');
    } catch {
      this.toast.error('2FA konnte nicht deaktiviert werden');
    }
  }

  openTotpSetup(): void {
    this.dialog.open({ title: '2FA einrichten', component: TotpSetupDialogComponent, width: 'sm' });
  }

  openExport(): void {
    this.dialog.open({ title: 'Daten exportieren', component: DataExportComponent, width: 'sm' });
  }

  openImport(): void {
    this.dialog.open({ title: 'Daten importieren', component: DataImportComponent, width: 'sm' });
  }

  formatDate(isoString?: string): string {
    if (!isoString) return '—';
    return new Date(isoString).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });
  }

  formatRelativeTime(isoString: string): string {
    const diff = Date.now() - new Date(isoString).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 2) return 'gerade eben';
    if (minutes < 60) return `vor ${minutes} Minuten`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `vor ${hours} Stunden`;
    return `vor ${Math.floor(hours / 24)} Tagen`;
  }
}
