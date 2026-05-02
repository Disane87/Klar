import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
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
  styleUrl: './login.component.css',
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
      const res = await firstValueFrom(
        this.authService.login({
          email: this.email(),
          password: this.password(),
          rememberMe: this.rememberMe(),
        }),
      );
      this.authStore.setSession(res.user, res.accessToken);
      await this.router.navigate(['/app']);
    } catch (err: unknown) {
      this.handleLoginError(err);
    } finally {
      this.loading.set(false);
    }
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
