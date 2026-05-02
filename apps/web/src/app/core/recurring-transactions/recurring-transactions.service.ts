import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type { RecurringFrequency } from '@klar/shared';

export interface UpdateRecurringTransactionRequest {
  name?:        string;
  amountCents?: number;
  categoryId?:  string;
  frequency?:   RecurringFrequency;
  dayOfMonth?:  number | null;
}

@Injectable({ providedIn: 'root' })
export class RecurringTransactionsService {
  private http = inject(HttpClient);

  patch(
    householdId: string,
    id: string,
    body: UpdateRecurringTransactionRequest,
  ): Promise<void> {
    return firstValueFrom(
      this.http.patch<void>(
        `/api/v1/households/${householdId}/recurring-transactions/${id}`,
        body,
      ),
    );
  }
}
