import { Component, computed, effect, inject, signal, viewChild, type ElementRef } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { HlmToggleGroupDirective } from '../../shared/ui/hlm/hlm-toggle-group.directive';
import { HlmToggleGroupItemDirective } from '../../shared/ui/hlm/hlm-toggle-group-item.directive';
import { KlarIconComponent } from '../../shared/icons/klar-icon.component';
import { KlarAvatarComponent } from '../../shared/ui/klar-avatar.component';
import { KlarDialogService } from '../../shared/ui/klar-dialog.service';
import { KlarImageCropDialogComponent } from '../../shared/ui/klar-image-crop-dialog.component';
import { KlarToastService } from '../../shared/ui/klar-toast.service';
import {
  KlarListGroupComponent,
  KlarListItemComponent,
} from '../../shared/ui/klar-list.component';
import { UserSettingsStore } from '../../core/user/user-settings.store';
import { HouseholdStore } from '../../core/household/household.store';
import { AuthStore } from '../../core/auth/auth.store';
import { ThemeService, type Theme } from '../../core/theme/theme.service';
import { PageHeaderService } from '../../core/page-header/page-header.service';
import { AuthService } from '../../core/auth/auth.service';
import { ChangePasswordDialogComponent } from './change-password-dialog.component';
import { DeleteAccountDialogComponent } from './delete-account-dialog.component';
import { TotpSetupDialogComponent } from './totp-setup-dialog.component';
import { DataExportComponent } from './data-export.component';
import { ImportMappingDialogComponent } from './import-mapping-dialog.component';
import { ConnectedAppsComponent } from './connected-apps/connected-apps.component';
import { OAuthGrantsService } from '../../core/oauth/oauth-grants.service';
import { DataTransferService, type ConfirmBody } from '../../core/data-transfer/data-transfer.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  host: { class: 'flex flex-col flex-1 min-h-0 overflow-hidden' },
  imports: [
    DatePipe,
    FormsModule,
    RouterLink,
    KlarListGroupComponent,
    KlarListItemComponent,
    KlarAvatarComponent,
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
  protected authStore = inject(AuthStore);
  protected themeService = inject(ThemeService);
  protected router = inject(Router);
  private authService = inject(AuthService);
  private dialog = inject(KlarDialogService);
  private toast = inject(KlarToastService);
  private dtService = inject(DataTransferService);
  private oauthGrantsService = inject(OAuthGrantsService);
  private pageHeader = inject(PageHeaderService);

  protected readonly version = signal('1.0.0');
  protected readonly buildId = signal('—');
  protected readonly serverHost = signal(
    typeof window !== 'undefined' ? window.location.hostname : 'klar.local',
  );

  readonly importInput = viewChild<ElementRef<HTMLInputElement>>('importInput');
  readonly avatarInput = viewChild<ElementRef<HTMLInputElement>>('avatarInput');
  readonly importing = signal(false);
  readonly avatarBusy = signal(false);

  readonly editingProfile = signal(false);
  readonly editDisplayName = signal('');
  readonly savingProfile = signal(false);

  readonly connectedAppsCount = signal<number | null>(null);
  readonly connectedAppsLabel = computed(() => {
    const n = this.connectedAppsCount();
    if (n === null) return 'OAuth-Zugriff verwalten (z.B. Claude Desktop)';
    if (n === 0) return 'Keine Apps verbunden';
    return n === 1 ? '1 App verbunden' : `${n} Apps verbunden`;
  });

  constructor() {
    this.pageHeader.set({
      title: 'Einstellungen',
      subtitle: 'Konto',
      rhsChip: this.authStore.user()?.email,
    });
    void this.refreshConnectedAppsCount();
    // Beim Schließen des Connected-Apps-Dialogs Counter neu laden, damit
    // ein Revoke aus dem Dialog sofort in der Settings-Liste reflektiert wird.
    effect(() => {
      const open = this.dialog.active();
      if (!open && this.connectedAppsDialogOpen) {
        this.connectedAppsDialogOpen = false;
        void this.refreshConnectedAppsCount();
      }
    });
  }

  private async refreshConnectedAppsCount(): Promise<void> {
    try {
      const list = await firstValueFrom(this.oauthGrantsService.list());
      this.connectedAppsCount.set(list.length);
    } catch {
      this.connectedAppsCount.set(null);
    }
  }

  openConnectedApps(): void {
    this.connectedAppsDialogOpen = true;
    this.dialog.open({
      title: 'Verbundene Apps',
      component: ConnectedAppsComponent,
      width: 'md',
    });
  }

  private connectedAppsDialogOpen = false;

  readonly avatarInitials = computed(() => {
    const name = this.authStore.user()?.displayName ?? '';
    return name.split(' ').map(p => p[0] ?? '').join('').slice(0, 2).toUpperCase() || '?';
  });

  readonly currentSessions = computed(() => this.store.sessions().filter(s => s.isCurrent));
  readonly otherSessions   = computed(() => this.store.sessions().filter(s => !s.isCurrent));

  readonly themeOptions: { value: Theme; label: string }[] = [
    { value: 'light',  label: 'Hell' },
    { value: 'dark',   label: 'Dunkel' },
    { value: 'system', label: 'System' },
  ];

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
    if (this.importing()) return;
    this.importInput()?.nativeElement.click();
  }

  triggerAvatarFile(): void {
    if (this.avatarBusy()) return;
    this.avatarInput()?.nativeElement.click();
  }

  onAvatarFileSelected(event: Event): void {
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
          this.avatarBusy.set(true);
          try {
            const { avatarUrl } = await firstValueFrom(
              this.authService.uploadAvatarDataUrl(dataUrl),
            );
            this.authStore.updateAvatar(avatarUrl);
            this.toast.success('Profilfoto aktualisiert');
          } finally {
            this.avatarBusy.set(false);
          }
        },
      },
    });
  }

  async removeAvatar(): Promise<void> {
    if (this.avatarBusy()) return;
    this.avatarBusy.set(true);
    try {
      await firstValueFrom(this.authService.deleteAvatar());
      this.authStore.updateAvatar(null);
      this.toast.success('Profilfoto entfernt');
    } catch {
      this.toast.error('Profilfoto konnte nicht entfernt werden');
    } finally {
      this.avatarBusy.set(false);
    }
  }

  async onImportFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      this.toast.error('Nur .json Dateien werden akzeptiert');
      input.value = '';
      return;
    }

    this.importing.set(true);
    try {
      const text = await file.text();
      const householdId = this.hhStore.activeId()!;
      const result = await this.dtService.analyze(householdId, text);

      const hasUnresolved =
        result.categoryMappings.some(m => m.resolvedId === null) ||
        result.projectMappings.some(m => m.resolvedId === null);

      if (hasUnresolved) {
        this.dialog.open({
          title: 'Import bestätigen',
          component: ImportMappingDialogComponent,
          inputs: { analyzeResult: result, fileContent: text },
          width: 'md',
        });
      } else {
        const body: ConfirmBody = { fileContent: text, categoryMappings: [], projectMappings: [] };
        const importResult = await this.dtService.confirm(householdId, body);
        const total = importResult.imported.transactions + importResult.imported.recurringTransactions;
        const skipped = importResult.skipped > 0 ? ` (${importResult.skipped} übersprungen)` : '';
        this.toast.success(`${total} Einträge importiert${skipped}`);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.message.toLowerCase().includes('schema')) {
        this.toast.error('Ungültige Export-Datei');
      }
      // other HTTP errors handled by ErrorInterceptor
    } finally {
      this.importing.set(false);
      input.value = '';
    }
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
