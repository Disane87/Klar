import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface AccountResponse {
  id: string;
  householdId: string;
  ownerId: string | null;
  name: string;
  type: string;
  currency: string;
  iban: string | null;
  bic: string | null;
  visibility: 'SHARED' | 'PRIVATE';
  archivedAt: string | null;
  syncEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateAccountInput {
  name?: string;
  visibility?: 'SHARED' | 'PRIVATE';
  archivedAt?: string | null;
  syncEnabled?: boolean;
}

@Injectable({ providedIn: 'root' })
export class AccountsService {
  private http = inject(HttpClient);

  private baseUrl(householdId: string): string {
    return `/api/v1/households/${householdId}/accounts`;
  }

  list(householdId: string): Observable<AccountResponse[]> {
    return this.http.get<AccountResponse[]>(this.baseUrl(householdId));
  }

  update(
    householdId: string,
    id: string,
    patch: UpdateAccountInput,
  ): Observable<AccountResponse> {
    return this.http.patch<AccountResponse>(`${this.baseUrl(householdId)}/${id}`, patch);
  }
}
