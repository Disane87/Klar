import { inject } from '@angular/core';
import { HttpInterceptorFn } from '@angular/common/http';
import { AuthStore } from '../auth/auth.store';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // Auth endpoints manage their own credentials via cookies; skip adding Bearer
  if (req.url.includes('/api/v1/auth/')) {
    return next(req);
  }

  const token = inject(AuthStore).accessToken();
  if (!token) return next(req);

  return next(
    req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }),
  );
};
