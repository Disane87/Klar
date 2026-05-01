import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { OidcService } from '../../core/auth/oidc.service';
import { AuthStore } from '../../core/auth/auth.store';
import { KlarWordmarkComponent } from '../../shared/brand/klar-wordmark.component';
import { KlarIconComponent } from '../../shared/icons/klar-icon.component';

@Component({
  selector: 'app-auth-callback',
  standalone: true,
  imports: [KlarWordmarkComponent, KlarIconComponent],
  template: `
    <div class="callback-page">
      <klar-wordmark [size]="24" />
      @if (errorMsg()) {
        <div class="callback-error">
          <klar-icon name="alert-triangle" [size]="18" />
          <span>{{ errorMsg() }}</span>
          <a href="/login" class="callback-retry">Zurück zur Anmeldung</a>
        </div>
      } @else {
        <div class="callback-loading">
          <div class="spinner"></div>
          <span>Anmeldung wird abgeschlossen …</span>
        </div>
      }
    </div>
  `,
  styles: [`
    .callback-page {
      min-height: 100dvh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 32px;
      background: var(--bg);
    }
    .callback-loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      color: var(--text-2);
      font-size: var(--body);
    }
    .spinner {
      width: 24px;
      height: 24px;
      border: 2px solid var(--border);
      border-top-color: var(--color-accent);
      border-radius: 50%;
      animation: klar-spin 0.7s linear infinite;
    }
    .callback-error {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      color: var(--color-expense);
      font-size: var(--body);
      text-align: center;
    }
    .callback-retry {
      margin-top: 8px;
      color: var(--color-accent);
      text-decoration: none;
      font-size: var(--body-sm);
    }
    .callback-retry:hover { text-decoration: underline; }
  `],
})
export class AuthCallbackComponent implements OnInit {
  private readonly route  = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly oidc   = inject(OidcService);
  private readonly store  = inject(AuthStore);

  readonly errorMsg = signal<string | null>(null);

  ngOnInit(): void {
    void this.handleCallback();
  }

  private async handleCallback(): Promise<void> {
    const params = this.route.snapshot.queryParamMap;
    const errorParam = params.get('error');
    const code = params.get('code');
    const redirect = params.get('redirect') ?? '/app';

    if (errorParam) {
      this.errorMsg.set(decodeURIComponent(errorParam));
      return;
    }

    if (!code) {
      this.errorMsg.set('Kein Authentifizierungscode erhalten');
      return;
    }

    try {
      const result = await this.oidc.exchangeCode(code);
      this.store.setSession(result.user, result.accessToken);
      await this.router.navigateByUrl(redirect, { replaceUrl: true });
    } catch {
      this.errorMsg.set('Anmeldung fehlgeschlagen. Bitte versuche es erneut.');
    }
  }
}
