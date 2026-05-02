import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ApiKeyListItem {
  id: string;
  name: string;
  scopes: string[];
  expiresAt: string | null;
  lastUsedAt: string | null;
  rateLimitPerMin: number;
  isRevoked: boolean;
  createdAt: string;
}

export interface CreateApiKeyRequest {
  name: string;
  scopes: string[];
  expiresAt?: string | null;
  rateLimitPerMin?: number;
}

export interface CreateApiKeyResponse extends ApiKeyListItem {
  fullKey: string; // shown once
}

@Injectable({ providedIn: 'root' })
export class ApiKeysService {
  private http = inject(HttpClient);

  private baseUrl(householdId: string): string {
    return `/api/v1/households/${householdId}/api-keys`;
  }

  list(householdId: string): Observable<ApiKeyListItem[]> {
    return this.http.get<ApiKeyListItem[]>(this.baseUrl(householdId));
  }

  create(householdId: string, body: CreateApiKeyRequest): Observable<CreateApiKeyResponse> {
    return this.http.post<CreateApiKeyResponse>(this.baseUrl(householdId), body);
  }

  revoke(householdId: string, id: string): Observable<void> {
    return this.http.patch<void>(`${this.baseUrl(householdId)}/${id}/revoke`, {});
  }

  delete(householdId: string, id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl(householdId)}/${id}`);
  }
}
