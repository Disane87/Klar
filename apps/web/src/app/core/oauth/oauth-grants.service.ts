import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface OAuthGrantSummary {
  id: string;
  clientId: string;
  clientName: string;
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
}
