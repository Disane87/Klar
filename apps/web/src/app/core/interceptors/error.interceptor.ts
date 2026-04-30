import { inject } from '@angular/core';
import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { KlarToastService } from '../../shared/ui/klar-toast.service';

interface ProblemDetail {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  instance?: string;
}

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const toast = inject(KlarToastService);

  return next(req).pipe(
    catchError((err: unknown) => {
      if (!(err instanceof HttpErrorResponse)) return throwError(() => err);

      // 401 is handled by refreshInterceptor; 422 is handled by forms
      if (err.status === 401 || err.status === 422) return throwError(() => err);

      const problem = err.error as ProblemDetail | undefined;
      const msg =
        problem?.detail ?? problem?.title ?? 'Ein Fehler ist aufgetreten.';
      toast.error(msg);

      return throwError(() => err);
    }),
  );
};
