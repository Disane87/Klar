import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import type { AuthUser } from '@klar/shared';
import { KlarWordmarkComponent } from '../../shared/brand/klar-wordmark.component';
import { KlarIconComponent } from '../../shared/icons/klar-icon.component';
import { HlmButtonDirective } from '../../shared/ui/hlm/hlm-button.directive';
import { HlmLoadingBtnDirective } from '../../shared/ui/hlm/hlm-loading-btn.directive';
import { HlmSpinnerComponent } from '../../shared/ui/hlm/hlm-spinner.component';
import { KlarInputComponent } from '../../shared/ui/klar-input.component';
import { AuthService } from '../../core/auth/auth.service';
import { AuthStore } from '../../core/auth/auth.store';
import { OidcService } from '../../core/auth/oidc.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    KlarWordmarkComponent,
    KlarIconComponent,
    HlmButtonDirective,
    HlmLoadingBtnDirective,
    HlmSpinnerComponent,
    KlarInputComponent,
  ],
  templateUrl: './login.component.html',
})
export class LoginComponent implements OnInit {
  private authService = inject(AuthService);
  private authStore = inject(AuthStore);
  private router = inject(Router);
  readonly oidc = inject(OidcService);

  readonly email = signal('');
  readonly password = signal('');
  readonly rememberMe = signal(false);
  readonly loading = signal(false);
  protected readonly statusTime = signal(this.getTimeString());
  readonly oidcLoading = signal(false);
  readonly submitted = signal(false);
  readonly serverError = signal<string | null>(null);
  readonly showResend = signal(false);

  // 2FA state
  readonly totpRequired = signal(false);
  readonly tempToken = signal('');
  readonly totpCode = signal('');
  readonly totpLoading = signal(false);
  readonly totpError = signal<string | null>(null);

  readonly emailError = computed(() => {
    const v = this.email();
    if (!v) return 'Pflichtfeld';
    if (!v.includes('@')) return 'Ungültige E-Mail-Adresse';
    return null;
  });

  readonly passwordError = computed(() => {
    const v = this.password();
    if (!v) return 'Pflichtfeld';
    if (v.length < 8) return 'Mindestens 8 Zeichen';
    return null;
  });

  readonly formValid = computed(() => !this.emailError() && !this.passwordError());

  async ngOnInit(): Promise<void> {
    await this.oidc.loadConfig();
  }

  async submit(): Promise<void> {
    this.submitted.set(true);
    if (!this.formValid() || this.loading()) return;

    this.loading.set(true);
    this.serverError.set(null);
    this.showResend.set(false);

    try {
      const res: { accessToken?: string; user?: unknown; requiresTotp?: boolean; tempToken?: string } = await firstValueFrom(
        this.authService.login({
          email: this.email(),
          password: this.password(),
          rememberMe: this.rememberMe(),
        }),
      );

      if (res.requiresTotp && res.tempToken) {
        this.totpRequired.set(true);
        this.tempToken.set(res.tempToken);
      } else if (res.accessToken && res.user) {
        this.authStore.setSession(res.user as AuthUser, res.accessToken);
        await this.router.navigate(['/app']);
      }
    } catch (err: unknown) {
      this.handleLoginError(err);
    } finally {
      this.loading.set(false);
    }
  }

  async verifyTotp(): Promise<void> {
    if (!this.totpCode() || this.totpLoading()) return;

    this.totpLoading.set(true);
    this.totpError.set(null);

    try {
      const res = await firstValueFrom(
        this.authService.verifyTotp(this.tempToken(), this.totpCode(), this.rememberMe()),
      );
      this.authStore.setSession(res.user, res.accessToken);
      await this.router.navigate(['/app']);
    } catch {
      this.totpError.set('Ungültiger Code. Bitte versuche es erneut.');
    } finally {
      this.totpLoading.set(false);
    }
  }

  backToPassword(): void {
    this.totpRequired.set(false);
    this.tempToken.set('');
    this.totpCode.set('');
    this.totpError.set(null);
  }

  async loginWithOidc(): Promise<void> {
    if (this.oidcLoading()) return;
    this.oidcLoading.set(true);
    try {
      await this.oidc.startLogin('/app');
      // Browser navigates away — no finally needed
    } catch {
      this.serverError.set('SSO-Anmeldung fehlgeschlagen. Bitte versuche es erneut.');
      this.oidcLoading.set(false);
    }
  }

  private handleLoginError(err: unknown): void {
    const status = (err as { status?: number }).status;
    if (status === 403) {
      this.serverError.set(
        'Deine E-Mail-Adresse ist noch nicht bestätigt. Bitte prüfe dein Postfach.',
      );
      this.showResend.set(true);
    } else if (status === 401) {
      this.serverError.set('E-Mail oder Passwort ist falsch.');
    } else {
      this.serverError.set('Ein unbekannter Fehler ist aufgetreten. Bitte versuche es erneut.');
    }
  }

  async resendVerification(): Promise<void> {
    if (!this.email()) return;
    try {
      await firstValueFrom(this.authService.resendVerification(this.email()));
    } catch {
      // Error handled by errorInterceptor
    }
  }

  toggleRememberMe(): void {
    this.rememberMe.update(v => !v);
  }

  private getTimeString(): string {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  }
}
