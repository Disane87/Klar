import { inject } from '@angular/core';
import { HttpInterceptorFn } from '@angular/common/http';
import { AuthStore } from '../auth/auth.store';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authStore = inject(AuthStore);
  const token = authStore.accessToken();

  // Only add Bearer token to same-origin requests (not external APIs like GitHub)
  const isExternal = req.url.startsWith('http');
  if (token && !isExternal && !req.url.includes('/auth/refresh')) {
    return next(
      req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }),
    );
  }

  return next(req);
};
