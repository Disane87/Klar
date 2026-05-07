import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export type ContractCycle = 'MONTHLY' | 'QUARTERLY' | 'YEARLY' | 'CUSTOM';
export type ContractStatus = 'CANDIDATE' | 'DETECTED' | 'CONFIRMED' | 'CANCELLED';

export interface ContractDto {
  id: string;
  householdId: string;
  name: string;
  merchant: string | null;
  categoryId: string | null;
  amountCents: number;
  cycle: ContractCycle;
  nextRenewalAt: string | null;
  cancelByAt: string | null;
  confidence: number;
  status: ContractStatus;
  detectedFromTransactionIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateContractInput {
  name: string;
  merchant?: string | null;
  categoryId?: string | null;
  amountCents: number;
  cycle: ContractCycle;
  nextRenewalAt?: string | null;
  cancelByAt?: string | null;
  confidence?: number;
  status?: ContractStatus;
}

export type UpdateContractInput = Partial<CreateContractInput>;

@Injectable({ providedIn: 'root' })
export class ContractsService {
  private http = inject(HttpClient);

  private base(householdId: string): string {
    return `/api/v1/households/${householdId}/contracts`;
  }

  list(householdId: string, status?: ContractStatus): Observable<ContractDto[]> {
    const params: Record<string, string> = {};
    if (status) params['status'] = status;
    return this.http.get<ContractDto[]>(this.base(householdId), { params });
  }

  create(householdId: string, body: CreateContractInput): Observable<ContractDto> {
    return this.http.post<ContractDto>(this.base(householdId), body);
  }

  update(householdId: string, id: string, body: UpdateContractInput): Observable<ContractDto> {
    return this.http.patch<ContractDto>(`${this.base(householdId)}/${id}`, body);
  }

  remove(householdId: string, id: string): Observable<void> {
    return this.http.delete<void>(`${this.base(householdId)}/${id}`);
  }

  recompute(householdId: string): Observable<{ count: number }> {
    return this.http.post<{ count: number }>(`${this.base(householdId)}/recompute`, {});
  }
}
