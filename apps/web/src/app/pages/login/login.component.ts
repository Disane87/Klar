import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { KlarWordmarkComponent } from '../../shared/brand/klar-wordmark.component';
import { KlarIconComponent } from '../../shared/icons/klar-icon.component';
import { KlarButtonComponent } from '../../shared/ui/klar-button.component';
import { KlarInputComponent } from '../../shared/ui/klar-input.component';
import { AuthService } from '../../core/auth/auth.service';
import { AuthStore } from '../../core/auth/auth.store';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    KlarWordmarkComponent,
    KlarIconComponent,
    KlarButtonComponent,
    KlarInputComponent,
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent {
  private authService = inject(AuthService);
  private authStore = inject(AuthStore);
  private router = inject(Router);

  readonly email = signal('');
  readonly password = signal('');
  readonly rememberMe = signal(false);
  readonly loading = signal(false);
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
}
