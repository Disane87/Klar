import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type {
  UserProfile,
  SessionItem,
  UpdateProfileRequest,
  ChangePasswordRequest,
} from '@klar/shared';

const BASE = '/api/v1/users/me';

@Injectable({ providedIn: 'root' })
export class UserSettingsService {
  private http = inject(HttpClient);

  getProfile(): Promise<UserProfile> {
    return firstValueFrom(this.http.get<UserProfile>(BASE));
  }

  updateProfile(dto: UpdateProfileRequest): Promise<UserProfile> {
    return firstValueFrom(this.http.patch<UserProfile>(BASE, dto));
  }

  changePassword(dto: ChangePasswordRequest): Promise<void> {
    return firstValueFrom(this.http.post<void>(`${BASE}/change-password`, dto));
  }

  listSessions(): Promise<SessionItem[]> {
    return firstValueFrom(this.http.get<SessionItem[]>(`${BASE}/sessions`));
  }

  revokeSession(tokenId: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${BASE}/sessions/${tokenId}`));
  }

  revokeAllSessions(): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${BASE}/sessions`));
  }

  unlinkOidc(identityId: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${BASE}/oidc/${identityId}`));
  }

  deleteAccount(): Promise<void> {
    return firstValueFrom(this.http.delete<void>(BASE));
  }
}
