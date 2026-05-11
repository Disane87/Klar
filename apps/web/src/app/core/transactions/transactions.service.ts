import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type { CreateTransactionRequest, UpdateTransactionRequest } from '@klar/shared';
import type { Transaction } from './transactions.store';

@Injectable({ providedIn: 'root' })
export class TransactionsService {
  private http = inject(HttpClient);

  private base(householdId: string): string {
    return `/api/v1/households/${householdId}/transactions`;
  }

  create(householdId: string, body: CreateTransactionRequest): Promise<Transaction> {
    return firstValueFrom(
      this.http.post<Transaction>(this.base(householdId), body),
    );
  }

  patch(householdId: string, id: string, body: UpdateTransactionRequest): Promise<Transaction> {
    return firstValueFrom(
      this.http.patch<Transaction>(`${this.base(householdId)}/${id}`, body),
    );
  }

  delete(householdId: string, id: string): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(`${this.base(householdId)}/${id}`),
    );
  }

  bulkSetVisibility(
    householdId: string,
    ids: readonly string[],
    visibility: 'PRIVATE' | 'SHARED',
  ): Promise<{ count: number }> {
    return firstValueFrom(
      this.http.patch<{ count: number }>(
        `${this.base(householdId)}/bulk-visibility`,
        { ids, visibility },
      ),
    );
  }
}
