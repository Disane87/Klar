import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { UserManager, User as OidcUser, WebStorageStateStore } from 'oidc-client-ts';
import { environment } from '@env/environment';
import { User } from '../models/user.model';

/** Manages OIDC authentication state and token lifecycle. */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private userManager: UserManager;

  private readonly _user = signal<User | null>(null);
  private readonly _token = signal<string | null>(null);
  private readonly _loading = signal(true);

  readonly user = this._user.asReadonly();
  readonly token = this._token.asReadonly();
  readonly isAuthenticated = computed(() => !!this._token());
  readonly loading = this._loading.asReadonly();

  constructor(private http: HttpClient) {
    this.userManager = new UserManager({
      authority: environment.oidc.authority,
      client_id: environment.oidc.clientId,
      redirect_uri: environment.oidc.redirectUri,
      scope: environment.oidc.scope,
      response_type: 'code',
      userStore: new WebStorageStateStore({ store: window.sessionStorage }),
      automaticSilentRenew: true,
    });

    this.init();
  }

  private async init() {
    try {
      const oidcUser = await this.userManager.getUser();
      if (oidcUser && !oidcUser.expired) {
        this._token.set(oidcUser.access_token);
        await this.loadProfile();
      }
    } catch (err) {
      console.error('Auth init failed:', err);
    } finally {
      this._loading.set(false);
    }
  }

  /** Redirect to OIDC login page. */
  async login(): Promise<void> {
    await this.userManager.signinRedirect();
  }

  /** Handle OIDC callback and exchange code for tokens. */
  async handleCallback(): Promise<void> {
    const oidcUser = await this.userManager.signinRedirectCallback();
    this._token.set(oidcUser.access_token);
    await this.loadProfile();
  }

  /** Logout the user. */
  async logout(): Promise<void> {
    await this.userManager.signoutRedirect();
    this._user.set(null);
    this._token.set(null);
  }

  /** Get the current access token for API calls. */
  getToken(): string | null {
    return this._token();
  }

  private async loadProfile(): Promise<void> {
    try {
      const user = await this.http
        .get<User>(`${environment.apiUrl}/auth/profile`)
        .toPromise();
      this._user.set(user ?? null);
    } catch {
      console.error('Failed to load user profile');
    }
  }
}
