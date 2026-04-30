import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { toHttpParams } from './helpers.js';

@Injectable({ providedIn: 'root' })
export class ApiClient {
  private readonly http = inject(HttpClient);

  get<TRes>(url: string, params?: Record<string, unknown>): Promise<TRes> {
    return firstValueFrom(
      this.http.get<TRes>(url, { params: toHttpParams(params ?? {}) }),
    );
  }

  post<TRes, TBody>(url: string, body: TBody): Promise<TRes> {
    return firstValueFrom(this.http.post<TRes>(url, body));
  }

  patch<TRes, TBody>(url: string, body: TBody): Promise<TRes> {
    return firstValueFrom(this.http.patch<TRes>(url, body));
  }

  delete(url: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(url));
  }
}
