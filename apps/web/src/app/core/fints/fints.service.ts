import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthStore } from '../auth/auth.store';

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

export interface FintsAttachedAccount {
  id: string;
  name: string;
  type: string;
  iban: string | null;
  bic: string | null;
  fintsAccountRef: string | null;
  lastKnownBalanceCents: number | null;
  lastBalanceAt: string | null;
  syncEnabled: boolean;
}

export interface FintsDeleteImpact {
  accounts: number;
  transactions: number;
  standingOrders: number;
}

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
  /** Linked Klar Account rows (FinTS sub-accounts user picked). */
  accounts: FintsAttachedAccount[];
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
  /** Bank uses a decoupled / pushTAN method — no code-input expected. */
  isDecoupled: boolean;
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

/** Bank-advertised statement-fetch capabilities cached per connection. */
export interface FintsCapabilities {
  maxLookbackDays: number | null;
  supportsHKCAZ: boolean;
  supportsHKKAZ: boolean;
  tanRequiredForStatements: boolean;
  extractedAt: string | null;
}

/** Mirrors apps/api/src/fints/realtime/fints-realtime.service.ts. */
export type FintsRunEventType = 'tan-required' | 'ok' | 'failed' | 'progress';
export interface FintsRunEvent {
  type: FintsRunEventType;
  syncRunId: string;
  data:
    | { syncRun: FintsSyncRunResponse; tanChallenge?: FintsTanChallenge }
    | { syncRun: FintsSyncRunResponse }
    | unknown;
}

@Injectable({ providedIn: 'root' })
export class FintsService {
  private http = inject(HttpClient);
  private authStore = inject(AuthStore);

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

  triggerSync(
    householdId: string,
    id: string,
    range?: { fromDate?: string; toDate?: string },
  ): Observable<FintsSyncRunWithChallenge> {
    return this.http.post<FintsSyncRunWithChallenge>(
      `${this.baseUrl(householdId)}/connections/${id}/sync`,
      range ?? {},
    );
  }

  getCapabilities(householdId: string, id: string): Observable<FintsCapabilities> {
    return this.http.get<FintsCapabilities>(
      `${this.baseUrl(householdId)}/connections/${id}/capabilities`,
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

  deleteImpact(householdId: string, id: string): Observable<FintsDeleteImpact> {
    return this.http.get<FintsDeleteImpact>(
      `${this.baseUrl(householdId)}/connections/${id}/delete-impact`,
    );
  }

  /**
   * Subscribes to the SSE stream for a sync run. Used by the setup wizard
   * to auto-progress past the decoupled / pushTAN step the moment the bank
   * confirms — no "Fertig" click needed. We can't use the native
   * EventSource API because it cannot send the Authorization header that
   * our JwtAuthGuard requires; we fall back to fetch + ReadableStream and
   * parse `data:` frames manually. Unsubscribing aborts the underlying
   * fetch, which closes the server-side stream cleanly.
   */
  streamSyncRunEvents(householdId: string, syncRunId: string): Observable<FintsRunEvent> {
    return new Observable<FintsRunEvent>(subscriber => {
      const controller = new AbortController();
      const url = `${this.baseUrl(householdId)}/sync-runs/${syncRunId}/events`;
      const token = this.authStore.accessToken();
      const run = async (): Promise<void> => {
        const res = await fetch(url, {
          method: 'GET',
          headers: {
            Accept: 'text/event-stream',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          signal: controller.signal,
          credentials: 'include',
        });
        if (!res.ok || !res.body) {
          throw new Error(`SSE handshake failed (${res.status})`);
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          // SSE frame separator is a blank line (\n\n). Process every
          // complete frame we have, leave the partial tail in the buffer.
          let sep: number;
          while ((sep = buffer.indexOf('\n\n')) !== -1) {
            const frame = buffer.slice(0, sep);
            buffer = buffer.slice(sep + 2);
            const dataLine = frame.split('\n').find(l => l.startsWith('data:'));
            if (!dataLine) continue;
            try {
              const parsed = JSON.parse(dataLine.slice(5).trim()) as FintsRunEvent;
              subscriber.next(parsed);
            } catch {
              // Malformed frame — ignore, keep streaming.
            }
          }
        }
      };
      run()
        .then(() => subscriber.complete())
        .catch(err => {
          if (controller.signal.aborted) {
            subscriber.complete();
          } else {
            subscriber.error(err);
          }
        });
      return () => controller.abort();
    });
  }
}
