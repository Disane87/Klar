import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { KlarIconComponent } from '../../shared/icons/klar-icon.component';
import { HlmButtonDirective } from '../../shared/ui/hlm/hlm-button.directive';
import { HlmSpinnerComponent } from '../../shared/ui/hlm/hlm-spinner.component';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-verify-email',
  standalone: true,
  imports: [RouterLink, KlarIconComponent, HlmButtonDirective, HlmSpinnerComponent],
  templateUrl: './verify-email.component.html',
  styleUrl: './verify-email.component.css',
})
export class VerifyEmailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private authService = inject(AuthService);

  readonly loading = signal(true);
  readonly success = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly emailFromQuery = signal<string | null>(null);
  readonly resendLoading = signal(false);
  readonly resendDone = signal(false);

  async ngOnInit(): Promise<void> {
    const params = this.route.snapshot.queryParamMap;
    const token = params.get('token');
    const email = params.get('email');
    if (email) this.emailFromQuery.set(email);

    if (!token) {
      this.loading.set(false);
      this.errorMessage.set('Kein Bestätigungs-Token gefunden. Bitte prüfe den Link in deiner E-Mail.');
      return;
    }

    try {
      await firstValueFrom(this.authService.verifyEmail(token));
      this.success.set(true);
    } catch (err: unknown) {
      const status = (err as { status?: number }).status;
      if (status === 404) {
        this.errorMessage.set('Dieser Bestätigungs-Link ist ungültig oder wurde bereits verwendet.');
      } else if (status === 410) {
        this.errorMessage.set('Dieser Bestätigungs-Link ist abgelaufen. Bitte fordere einen neuen an.');
      } else {
        this.errorMessage.set('E-Mail-Bestätigung fehlgeschlagen. Bitte versuche es erneut.');
      }
    } finally {
      this.loading.set(false);
    }
  }

  async resendVerification(): Promise<void> {
    const email = this.emailFromQuery();
    if (!email || this.resendLoading()) return;

    this.resendLoading.set(true);
    try {
      await firstValueFrom(this.authService.resendVerification(email));
      this.resendDone.set(true);
    } catch {
      // Error handled by errorInterceptor
    } finally {
      this.resendLoading.set(false);
    }
  }
}
