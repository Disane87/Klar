import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import type {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
  RefreshResponse,
  AuthUser,
} from '@klar/shared';

const BASE = '/api/v1/auth';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);

  login(body: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${BASE}/login`, body, {
      withCredentials: true,
    });
  }

  register(body: RegisterRequest): Observable<RegisterResponse> {
    return this.http.post<RegisterResponse>(`${BASE}/register`, body, {
      withCredentials: true,
    });
  }

  logout(): Observable<void> {
    return this.http.post<void>(`${BASE}/logout`, {}, { withCredentials: true });
  }

  refresh(): Observable<RefreshResponse> {
    return this.http.post<RefreshResponse>(`${BASE}/refresh`, {}, {
      withCredentials: true,
    });
  }

  verifyEmail(token: string): Observable<{ message: string }> {
    return this.http.get<{ message: string }>(`${BASE}/verify-email`, {
      params: { token },
      withCredentials: true,
    });
  }

  resendVerification(email: string): Observable<void> {
    return this.http.post<void>(`${BASE}/resend-verification`, { email }, {
      withCredentials: true,
    });
  }

  getMe(): Observable<AuthUser> {
    return this.http.get<AuthUser>('/api/v1/users/me', { withCredentials: true });
  }

  // ── TOTP / 2FA ─────────────────────────────────────────────────────

  /** Verify TOTP code with tempToken after login - returns real tokens. */
  verifyTotp(tempToken: string, code: string, rememberMe?: boolean): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${BASE}/totp/verify`, {
      tempToken,
      code,
      rememberMe,
    }, { withCredentials: true });
  }

  /** Initiate 2FA setup - returns secret and QR code URI. */
  setupTotp(): Observable<{ secret: string; uri: string }> {
    return this.http.get<{ secret: string; uri: string }>(`${BASE}/totp/setup`, {
      withCredentials: true,
    });
  }

  /** Enable 2FA after verifying a code. */
  enableTotp(code: string): Observable<void> {
    return this.http.post<void>(`${BASE}/totp/enable`, { code }, {
      withCredentials: true,
    });
  }

  /** Disable 2FA for current user. */
  disableTotp(): Observable<void> {
    return this.http.delete<void>(`${BASE}/totp`, { withCredentials: true });
  }

  uploadAvatar(file: File): Observable<{ avatarUrl: string }> {
    return new Observable(observer => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d')!;
        const size = Math.min(img.width, img.height);
        const sx = (img.width - size) / 2;
        const sy = (img.height - size) / 2;
        ctx.drawImage(img, sx, sy, size, size, 0, 0, 128, 128);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        this.http.post<{ avatarUrl: string }>('/api/v1/users/me/avatar',
          { data: dataUrl },
          { withCredentials: true },
        ).subscribe(observer);
      };
      img.onerror = () => { URL.revokeObjectURL(objectUrl); observer.error(new Error('Bild konnte nicht geladen werden')); };
      img.src = objectUrl;
    });
  }

  deleteAvatar(): Observable<void> {
    return this.http.delete<void>('/api/v1/users/me/avatar', { withCredentials: true });
  }
}
