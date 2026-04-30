import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import type { AuthUser } from '@klar/shared';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class AuthStore {
  private authService = inject(AuthService);
  private router = inject(Router);

  private _user = signal<AuthUser | null>(null);
  private _accessToken = signal<string | null>(null);
  private _isInitialized = signal(false);

  readonly user = this._user.asReadonly();
  readonly accessToken = this._accessToken.asReadonly();
  readonly isAuthenticated = computed(() => !!this._user());
  readonly isInitialized = this._isInitialized.asReadonly();

  setSession(user: AuthUser, accessToken: string): void {
    this._user.set(user);
    this._accessToken.set(accessToken);
  }

  clearSession(): void {
    this._user.set(null);
    this._accessToken.set(null);
  }

  markInitialized(): void {
    this._isInitialized.set(true);
  }

  async initSession(): Promise<void> {
    try {
      const res = await firstValueFrom(this.authService.refresh());
      this.setSession(res.user, res.accessToken);
    } catch {
      // No valid refresh cookie — stay logged out, no crash
    } finally {
      this.markInitialized();
    }
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.authService.logout());
    } catch {
      // Ignore logout errors — clear session regardless
    }
    this.clearSession();
    await this.router.navigate(['/login']);
  }
}
