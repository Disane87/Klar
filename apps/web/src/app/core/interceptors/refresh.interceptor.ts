import { inject } from '@angular/core';
import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import {
  BehaviorSubject,
  EMPTY,
  throwError,
  switchMap,
  filter,
  take,
  catchError,
} from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { AuthStore } from '../auth/auth.store';

// Module-level singleton — shared across all interceptor invocations
let refreshInProgress = false;
const refreshDone$ = new BehaviorSubject<string | null>(null);

export const refreshInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const authStore = inject(AuthStore);
  const router = inject(Router);

  return next(req).pipe(
    catchError((err: unknown) => {
      if (
        !(err instanceof HttpErrorResponse) ||
        err.status !== 401 ||
        req.url.includes('/auth/refresh')
      ) {
        return throwError(() => err);
      }

      if (refreshInProgress) {
        // Wait for the in-flight refresh to complete, then retry with new token
        return refreshDone$.pipe(
          filter((token): token is string => token !== null),
          take(1),
          switchMap(token =>
            next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })),
          ),
        );
      }

      refreshInProgress = true;
      refreshDone$.next(null);

      return authService.refresh().pipe(
        switchMap(res => {
          authStore.setSession(res.user, res.accessToken);
          refreshInProgress = false;
          refreshDone$.next(res.accessToken);
          return next(
            req.clone({ setHeaders: { Authorization: `Bearer ${res.accessToken}` } }),
          );
        }),
        catchError(refreshErr => {
          refreshInProgress = false;
          authStore.clearSession();
          router.navigate(['/login']);
          return EMPTY;
        }),
      );
    }),
  );
};
