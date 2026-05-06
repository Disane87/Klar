import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface OAuthGrantSummary {
  id: string;
  clientId: string;
  /** Effektiver Anzeigename (User-Override oder vom Client gesetzt). */
  clientName: string;
  /** Roher `clientName` aus der OAuth-Registration. */
  originalClientName: string;
  /** Manueller Override; null = kein Override gesetzt. */
  displayName: string | null;
  clientLogoUri: string | null;
  scopes: string[];
  createdAt: string;
  lastUsedAt: string | null;
  refreshExpiresAt: string;
}

const BASE = '/api/v1/oauth/grants';

@Injectable({ providedIn: 'root' })
export class OAuthGrantsService {
  private http = inject(HttpClient);

  list(): Observable<OAuthGrantSummary[]> {
    return this.http.get<OAuthGrantSummary[]>(BASE);
  }

  revoke(id: string): Observable<void> {
    return this.http.delete<void>(`${BASE}/${id}`);
  }

  /** `null` resettet auf den Original-Namen aus der OAuth-Registration. */
  rename(id: string, displayName: string | null): Observable<void> {
    return this.http.patch<void>(`${BASE}/${id}`, { displayName });
  }
}
