import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import * as QRCode from 'qrcode';
import { HlmInputDirective } from '../../shared/ui/hlm/hlm-input.directive';
import { KlarDialogService } from '../../shared/ui/klar-dialog.service';
import { KlarDialogFooterComponent } from '../../shared/ui/klar-dialog-footer.component';
import { KlarToastService } from '../../shared/ui/klar-toast.service';
import { AuthService } from '../../core/auth/auth.service';
import { UserSettingsStore } from '../../core/user/user-settings.store';

@Component({
  selector: 'app-totp-setup-dialog',
  standalone: true,
  imports: [FormsModule, HlmInputDirective, KlarDialogFooterComponent],
  template: `
    <div class="flex flex-col gap-4">
      <div class="text-center">
        <p class="text-[var(--label)] text-[var(--text-2)] mb-3">
          Scanne diesen QR-Code mit deiner Authenticator-App:
        </p>
        <div class="flex justify-center p-4 bg-white rounded-lg border border-[var(--border)] mb-3">
          <img [src]="qrCodeDataUrl()" alt="QR Code" class="w-40 h-40" />
        </div>
        <div class="p-3 bg-[var(--surface)] rounded border border-[var(--border)] text-left mb-3">
          <p class="text-[var(--label)] text-[var(--text-muted)] mb-1">Oder manuell eingeben:</p>
          <div class="flex items-center gap-2">
            <code class="flex-1 text-[var(--body)] font-mono text-[var(--text-2)] bg-[var(--bg)] p-2 rounded overflow-x-auto">
              {{ secret() }}
            </code>
            <button type="button" class="shrink-0 text-[var(--body-sm)] text-[var(--color-accent)] bg-transparent border-none p-2 cursor-pointer" (click)="copySecret()" title="Kopieren">
              📋
            </button>
          </div>
        </div>
        <p class="text-[var(--label)] text-[var(--text-muted)] mb-3">
          Gib jetzt den 6-stelligen Code aus deiner App ein:
        </p>
        <input hlmInput type="text" placeholder="000 000" 
               [ngModel]="code()" (ngModelChange)="code.set($event)"
               class="font-mono text-center text-xl tracking-[0.3em] py-3 mb-2" 
               autocomplete="one-time-code" inputmode="numeric" maxlength="6" />
        @if (error()) {
          <p class="text-[var(--label)] text-[var(--color-expense)]">{{ error() }}</p>
        }
      </div>

      <klar-dialog-footer
        confirmLabel="2FA aktivieren"
        [confirmDisabled]="code().length < 6"
        [confirmLoading]="saving()"
        (confirm)="enable()"
      />
    </div>
  `,
})
export class TotpSetupDialogComponent {
  private authService = inject(AuthService);
  private userStore = inject(UserSettingsStore);
  readonly dialog = inject(KlarDialogService);
  private toast = inject(KlarToastService);

  readonly step = signal<'qr' | 'verify'>('qr');
  readonly secret = signal('');
  readonly uri = signal('');
  readonly code = signal('');
  readonly saving = signal(false);
  readonly error = signal('');

  qrCodeDataUrl = signal('');

  async ngOnInit(): Promise<void> {
    try {
      const { secret, uri } = await firstValueFrom(this.authService.setupTotp());
      this.secret.set(secret);
      this.uri.set(uri);
      const dataUrl = await QRCode.toDataURL(uri, { width: 200, margin: 1 });
      this.qrCodeDataUrl.set(dataUrl);
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status;
      if (status === 401) {
        this.toast.error('Sitzung abgelaufen. Bitte neu einloggen.');
      } else {
        this.toast.error('2FA-Einrichtung fehlgeschlagen');
      }
      this.dialog.close();
    }
  }

  copySecret(): void {
    navigator.clipboard.writeText(this.secret());
    this.toast.success('Schlüssel kopiert');
  }

  async enable(): Promise<void> {
    if (this.code().length < 6) return;
    this.saving.set(true);
    this.error.set('');
    try {
      await firstValueFrom(this.authService.enableTotp(this.code()));
      await this.userStore.loadProfile();
      this.toast.success('2FA aktiviert');
      this.dialog.close();
    } catch {
      this.error.set('Ungültiger Code. Bitte erneut versuchen.');
    } finally {
      this.saving.set(false);
    }
  }
}