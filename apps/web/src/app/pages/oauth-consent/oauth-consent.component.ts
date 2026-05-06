import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { KlarButtonComponent } from '../../shared/ui/klar-button.component';
import { KlarIconComponent } from '../../shared/icons/klar-icon.component';
import { KlarWordmarkComponent } from '../../shared/brand/klar-wordmark.component';
import { AuthStore } from '../../core/auth/auth.store';
import {
  OAuthConsentService,
  type AuthorizeRequestParams,
  type ConsentInfo,
} from '../../core/oauth/oauth-consent.service';

const REQUIRED_PARAMS: (keyof AuthorizeRequestParams)[] = [
  'response_type',
  'client_id',
  'redirect_uri',
  'scope',
  'state',
  'code_challenge',
  'code_challenge_method',
];

@Component({
  selector: 'app-oauth-consent',
  standalone: true,
  imports: [KlarButtonComponent, KlarIconComponent, KlarWordmarkComponent],
  templateUrl: './oauth-consent.component.html',
})
export class OAuthConsentComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(OAuthConsentService);
  private readonly authStore = inject(AuthStore);

  readonly info = signal<ConsentInfo | null>(null);
  readonly loading = signal(true);
  readonly approving = signal(false);
  readonly denying = signal(false);
  readonly error = signal<string | null>(null);

  readonly userEmail = computed(() => this.authStore.user()?.email ?? '');
  readonly clientHost = computed(() => {
    const c = this.info()?.client;
    if (!c?.clientUri) return null;
    try {
      return new URL(c.clientUri).host;
    } catch {
      return null;
    }
  });

  readonly redirectHost = computed(() => {
    const u = this.info()?.redirectUri;
    if (!u) return null;
    try {
      return new URL(u).host;
    } catch {
      return null;
    }
  });

  private readonly params = computed<AuthorizeRequestParams | null>(() => {
    const qp = this.route.snapshot.queryParamMap;
    const obj: Record<string, string> = {};
    for (const key of REQUIRED_PARAMS) {
      const v = qp.get(key);
      if (!v) return null;
      obj[key] = v;
    }
    return obj as unknown as AuthorizeRequestParams;
  });

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    const p = this.params();
    if (!p) {
      this.error.set('Anfrage unvollständig — bitte App neu starten.');
      this.loading.set(false);
      return;
    }
    try {
      const info = await firstValueFrom(this.api.getInfo(p));
      this.info.set(info);
    } catch (err: unknown) {
      const msg =
        (err as { error?: { error_description?: string } })?.error?.error_description ??
        'Anfrage konnte nicht geladen werden.';
      this.error.set(msg);
    } finally {
      this.loading.set(false);
    }
  }

  async approve(): Promise<void> {
    const p = this.params();
    if (!p || this.approving() || this.denying()) return;
    this.approving.set(true);
    this.error.set(null);
    try {
      const { redirectUrl } = await firstValueFrom(this.api.decide(p, true));
      window.location.assign(redirectUrl);
    } catch (err: unknown) {
      const msg =
        (err as { error?: { error_description?: string } })?.error?.error_description ??
        'Genehmigung fehlgeschlagen.';
      this.error.set(msg);
      this.approving.set(false);
    }
  }

  async deny(): Promise<void> {
    const p = this.params();
    if (!p || this.approving() || this.denying()) return;
    this.denying.set(true);
    this.error.set(null);
    try {
      const { redirectUrl } = await firstValueFrom(this.api.decide(p, false));
      window.location.assign(redirectUrl);
    } catch (err: unknown) {
      const msg =
        (err as { error?: { error_description?: string } })?.error?.error_description ??
        'Ablehnung fehlgeschlagen.';
      this.error.set(msg);
      this.denying.set(false);
    }
  }

  cancel(): void {
    void this.router.navigate(['/app']);
  }
}
