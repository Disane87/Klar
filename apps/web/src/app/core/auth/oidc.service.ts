import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type { AuthUser } from '@klar/shared';

interface OidcConfigResponse {
  enabled: boolean;
  providerName: string;
}

interface AuthorizeResponse {
  authorizeUrl: string;
}

interface HandoverResponse {
  accessToken: string;
  user: AuthUser;
}

const BASE = '/api/v1/auth';

@Injectable({ providedIn: 'root' })
export class OidcService {
  private http = inject(HttpClient);

  private readonly _enabled = signal(false);
  private readonly _providerName = signal('SSO');
  private _configLoaded = false;

  readonly enabled = this._enabled.asReadonly();
  readonly providerName = this._providerName.asReadonly();

  async loadConfig(): Promise<void> {
    if (this._configLoaded) return;
    try {
      const cfg = await firstValueFrom(
        this.http.get<OidcConfigResponse>(`${BASE}/oidc/config`),
      );
      this._enabled.set(cfg.enabled);
      this._providerName.set(cfg.providerName);
      this._configLoaded = true;
    } catch {
      // Non-fatal — OIDC remains disabled
    }
  }

  async startLogin(redirectAfterLogin = '/app'): Promise<void> {
    const params = new URLSearchParams({ redirect: redirectAfterLogin });
    const { authorizeUrl } = await firstValueFrom(
      this.http.get<AuthorizeResponse>(`${BASE}/oidc/authorize?${params.toString()}`),
    );
    window.location.href = authorizeUrl;
  }

  exchangeCode(code: string): Promise<HandoverResponse> {
    return firstValueFrom(
      this.http.post<HandoverResponse>(`${BASE}/handover`, { code }, { withCredentials: true }),
    );
  }

  getLinkedIdentities(): Promise<{ providerName: string; email: string; createdAt: string; lastLoginAt: string | null }[]> {
    return firstValueFrom(
      this.http.get<{ providerName: string; email: string; createdAt: string; lastLoginAt: string | null }[]>(
        `${BASE}/oidc/identities`,
        { withCredentials: true },
      ),
    );
  }

  unlinkIdentity(providerName: string): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(`${BASE}/oidc/identities/${encodeURIComponent(providerName)}`, {
        withCredentials: true,
      }),
    );
  }
}
