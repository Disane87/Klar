import { Injectable, computed, inject, signal } from '@angular/core';
import type { UserProfile, SessionItem } from '@klar/shared';
import { UserSettingsService } from './user-settings.service';
import { AuthStore } from '../auth/auth.store';

@Injectable({ providedIn: 'root' })
export class UserSettingsStore {
  private service = inject(UserSettingsService);
  private authStore = inject(AuthStore);

  private _profile = signal<UserProfile | null>(null);
  private _sessions = signal<SessionItem[]>([]);
  private _loading = signal(false);
  private _sessionsLoading = signal(false);

  readonly profile = this._profile.asReadonly();
  readonly sessions = this._sessions.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly sessionsLoading = this._sessionsLoading.asReadonly();

  readonly hasPassword = computed(() => this._profile()?.hasPassword ?? false);
  readonly oidcIdentities = computed(() => this._profile()?.oidcIdentities ?? []);
  readonly canUnlinkOidc = computed(() =>
    this.hasPassword() || this.oidcIdentities().length > 1,
  );

  async loadProfile(): Promise<void> {
    this._loading.set(true);
    try {
      const profile = await this.service.getProfile();
      this._profile.set(profile);
    } finally {
      this._loading.set(false);
    }
  }

  async updateProfile(dto: { displayName?: string; email?: string }): Promise<void> {
    const updated = await this.service.updateProfile(dto);
    this._profile.set(updated);
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await this.service.changePassword({ currentPassword, newPassword });
  }

  async loadSessions(): Promise<void> {
    this._sessionsLoading.set(true);
    try {
      this._sessions.set(await this.service.listSessions());
    } finally {
      this._sessionsLoading.set(false);
    }
  }

  async revokeSession(tokenId: string): Promise<void> {
    await this.service.revokeSession(tokenId);
    this._sessions.update(list => list.filter(s => s.id !== tokenId));
  }

  async revokeAllSessions(): Promise<void> {
    await this.service.revokeAllSessions();
    this._sessions.update(list => list.filter(s => s.isCurrent));
  }

  async unlinkOidc(identityId: string): Promise<void> {
    await this.service.unlinkOidc(identityId);
    this._profile.update(p =>
      p ? { ...p, oidcIdentities: p.oidcIdentities.filter(o => o.id !== identityId) } : p,
    );
  }

  async deleteAccount(): Promise<void> {
    await this.service.deleteAccount();
    await this.authStore.logout();
  }
}
