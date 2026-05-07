import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { KlarWordmarkComponent } from '../../shared/brand/klar-wordmark.component';
import { KlarIconComponent } from '../../shared/icons/klar-icon.component';
import { KlarButtonComponent } from '../../shared/ui/klar-button.component';
import { KlarInputComponent } from '../../shared/ui/klar-input.component';
import { KlarAuthBrandPaneComponent } from '../../shared/ui/klar-auth-brand-pane.component';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    KlarWordmarkComponent,
    KlarIconComponent,
    KlarButtonComponent,
    KlarInputComponent,
    KlarAuthBrandPaneComponent,
  ],
  templateUrl: './register.component.html',
})
export class RegisterComponent implements OnInit {
  private authService = inject(AuthService);
  private route = inject(ActivatedRoute);

  readonly email = signal('');
  readonly displayName = signal('');
  readonly password = signal('');
  readonly confirmPassword = signal('');
  readonly loading = signal(false);
  readonly submitted = signal(false);
  readonly serverError = signal<string | null>(null);
  readonly success = signal(false);

  readonly emailError = computed(() => {
    const v = this.email();
    if (!v) return 'Pflichtfeld';
    if (!v.includes('@')) return 'Ungültige E-Mail-Adresse';
    return null;
  });

  readonly displayNameError = computed(() => {
    if (!this.displayName().trim()) return 'Pflichtfeld';
    return null;
  });

  readonly passwordError = computed(() => {
    const v = this.password();
    if (!v) return 'Pflichtfeld';
    if (v.length < 8) return 'Mindestens 8 Zeichen';
    return null;
  });

  readonly confirmPasswordError = computed(() => {
    const v = this.confirmPassword();
    if (!v) return 'Pflichtfeld';
    if (v !== this.password()) return 'Passwörter stimmen nicht überein';
    return null;
  });

  readonly formValid = computed(
    () =>
      !this.emailError() &&
      !this.displayNameError() &&
      !this.passwordError() &&
      !this.confirmPasswordError(),
  );

  readonly inviteToken = signal<string | null>(null);

  ngOnInit(): void {
    const inviteToken = this.route.snapshot.queryParamMap.get('invite');
    if (inviteToken) sessionStorage.setItem('pendingInviteToken', inviteToken);
    this.inviteToken.set(inviteToken ?? sessionStorage.getItem('pendingInviteToken'));

    const emailParam = this.route.snapshot.queryParamMap.get('email');
    if (emailParam) this.email.set(emailParam);
  }

  async submit(): Promise<void> {
    this.submitted.set(true);
    if (!this.formValid() || this.loading()) return;

    this.loading.set(true);
    this.serverError.set(null);

    try {
      await firstValueFrom(
        this.authService.register({
          email: this.email(),
          displayName: this.displayName(),
          password: this.password(),
          inviteToken: this.inviteToken() ?? undefined,
        }),
      );
      this.success.set(true);
    } catch (err: unknown) {
      const status = (err as { status?: number }).status;
      if (status === 409) {
        this.serverError.set(
          'Diese E-Mail-Adresse ist bereits registriert.',
        );
      } else {
        this.serverError.set(
          'Registrierung fehlgeschlagen. Bitte versuche es erneut.',
        );
      }
    } finally {
      this.loading.set(false);
    }
  }
}
