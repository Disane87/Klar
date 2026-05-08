import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

// ── Type contracts mirror apps/api/src/fints/fints.service.ts ──────────────

export type FintsConnectionStatus =
  | 'SETUP'
  | 'ACTIVE'
  | 'TAN_REQUIRED'
  | 'REAUTH_REQUIRED'
  | 'DISABLED'
  | 'ERROR';

export type FintsSyncStatus =
  | 'RUNNING'
  | 'OK'
  | 'FAILED'
  | 'TAN_REQUIRED'
  | 'REAUTH_REQUIRED'
  | 'CANCELLED';

export type FintsSyncTrigger = 'CRON' | 'MANUAL' | 'SETUP';

export interface FintsConnectionResponse {
  id: string;
  ownerId: string;
  householdId: string;
  bankName: string;
  blz: string;
  loginName: string;
  status: FintsConnectionStatus;
  lastScaAt: string | null;
  scaExpiresAt: string | null;
  lastSyncAt: string | null;
  lastSyncStatus: FintsSyncStatus | null;
  createdAt: string;
  updatedAt: string;
}

export interface FintsSyncRunResponse {
  id: string;
  connectionId: string;
  status: FintsSyncStatus;
  triggeredBy: FintsSyncTrigger;
  startedAt: string;
  finishedAt: string | null;
  bookingsFetched: number;
  bookingsImported: number;
  bookingsSkipped: number;
  errorCode: string | null;
  errorMessage: string | null;
}

export interface FintsTanChallenge {
  tanReference: string;
  prompt: string;
  mediaName?: string;
  mediaBase64?: string;
  mediaMimeType?: string;
}

export interface FintsSyncRunWithChallenge {
  syncRun: FintsSyncRunResponse;
  tanChallenge: FintsTanChallenge | null;
}

export interface FintsCreateConnectionResponse extends FintsSyncRunWithChallenge {
  connection: FintsConnectionResponse;
}

export interface FintsBankLookupRecord {
  blz: string;
  name: string;
  city?: string;
  bic?: string;
  pinTanUrl?: string;
  pinTanVersion?: string;
  hbciVersion?: string;
}

export type FintsBankLookupResult =
  | { found: true; record: FintsBankLookupRecord; fintsCapable: boolean; message?: string }
  | { found: false; allowManualOverride: true };

export interface FintsCreateConnectionRequest {
  bankName: string;
  blz: string;
  serverUrl: string;
  loginName: string;
  pin: string;
  customerId?: string;
}

/** From lib-fints' BankAccount — only the fields the wizard renders. */
export interface FintsDiscoveredAccount {
  accountNumber: string;
  iban?: string;
  bic?: string;
  currency?: string;
  holder1?: string;
  holder2?: string;
  product?: string;
  accountType?: string;
}

export interface FintsAttachAccountInput {
  fintsAccountRef: string;
  name?: string;
  iban?: string;
  bic?: string;
  visibility?: 'SHARED' | 'PRIVATE';
}

@Injectable({ providedIn: 'root' })
export class FintsService {
  private http = inject(HttpClient);

  private baseUrl(householdId: string): string {
    return `/api/v1/households/${householdId}/fints`;
  }

  lookupBank(householdId: string, blz: string): Observable<FintsBankLookupResult> {
    return this.http.get<FintsBankLookupResult>(
      `${this.baseUrl(householdId)}/banks/lookup`,
      { params: { blz } },
    );
  }

  listBanks(householdId: string): Observable<FintsBankLookupRecord[]> {
    return this.http.get<FintsBankLookupRecord[]>(
      `${this.baseUrl(householdId)}/banks`,
    );
  }

  list(householdId: string): Observable<FintsConnectionResponse[]> {
    return this.http.get<FintsConnectionResponse[]>(`${this.baseUrl(householdId)}/connections`);
  }

  get(householdId: string, id: string): Observable<FintsConnectionResponse> {
    return this.http.get<FintsConnectionResponse>(`${this.baseUrl(householdId)}/connections/${id}`);
  }

  create(
    householdId: string,
    body: FintsCreateConnectionRequest,
  ): Observable<FintsCreateConnectionResponse> {
    return this.http.post<FintsCreateConnectionResponse>(
      `${this.baseUrl(householdId)}/connections`,
      body,
    );
  }

  triggerSync(householdId: string, id: string): Observable<FintsSyncRunWithChallenge> {
    return this.http.post<FintsSyncRunWithChallenge>(
      `${this.baseUrl(householdId)}/connections/${id}/sync`,
      {},
    );
  }

  submitTan(
    householdId: string,
    syncRunId: string,
    tan: string,
  ): Observable<FintsSyncRunWithChallenge> {
    return this.http.post<FintsSyncRunWithChallenge>(
      `${this.baseUrl(householdId)}/sync-runs/${syncRunId}/tan`,
      { tan },
    );
  }

  discoveredAccounts(
    householdId: string,
    id: string,
  ): Observable<FintsDiscoveredAccount[]> {
    return this.http.get<FintsDiscoveredAccount[]>(
      `${this.baseUrl(householdId)}/connections/${id}/discovered-accounts`,
    );
  }

  attachAccounts(
    householdId: string,
    id: string,
    accounts: FintsAttachAccountInput[],
  ): Observable<unknown[]> {
    return this.http.post<unknown[]>(
      `${this.baseUrl(householdId)}/connections/${id}/accounts`,
      { accounts },
    );
  }

  delete(householdId: string, id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl(householdId)}/connections/${id}`);
  }
}
