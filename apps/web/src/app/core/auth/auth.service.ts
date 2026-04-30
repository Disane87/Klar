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
}
