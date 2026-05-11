import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type { RecurringFrequency } from '@klar/shared';

export interface CreateRecurringTransactionRequest {
  name:        string;
  amountCents: number;
  categoryId:  string;
  frequency:   RecurringFrequency;
  dayOfMonth?: number | null;
  startDate:   string;
  projectId?:  string | null;
  visibility?: string;
  note?:       string | null;
  color?:      string | null;
  icon?:       string | null;
  isActive?:   boolean;
  payrollInput?: Record<string, unknown> | null;
  splits?:     { label: string; amountCents: number; sortOrder?: number; note?: string | null }[];
}

export interface UpdateRecurringTransactionRequest {
  name?:        string;
  amountCents?: number;
  categoryId?:  string;
  frequency?:   RecurringFrequency;
  dayOfMonth?:  number | null;
  color?:       string | null;
  icon?:        string | null;
  payrollInput?: Record<string, unknown> | null;
}

export interface RecurringTransactionResponse {
  id:               string;
  householdId:      string;
  createdByUserId:  string;
  name:             string;
  amountCents:     number;
  categoryId:       string;
  projectId:        string | null;
  frequency:        RecurringFrequency;
  customDays:       number | null;
  dayOfMonth:       number | null;
  startDate:        string;
  endDate:          string | null;
  visibility:       string;
  isVariable:       boolean;
  note:             string | null;
  isActive:         boolean;
  createdAt:        string;
  updatedAt:        string;
}

@Injectable({ providedIn: 'root' })
export class RecurringTransactionsService {
  private http = inject(HttpClient);

  create(
    householdId: string,
    body: CreateRecurringTransactionRequest,
  ): Promise<RecurringTransactionResponse> {
    return firstValueFrom(
      this.http.post<RecurringTransactionResponse>(
        `/api/v1/households/${householdId}/recurring-transactions`,
        body,
      ),
    );
  }

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

  delete(householdId: string, id: string): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(
        `/api/v1/households/${householdId}/recurring-transactions/${id}`,
      ),
    );
  }
}