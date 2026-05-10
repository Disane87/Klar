import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export type FixedCostCycle =
  | 'MONTHLY'
  | 'QUARTERLY'
  | 'HALF_YEARLY'
  | 'YEARLY'
  | 'CUSTOM';
export type FixedCostStatus = 'CANDIDATE' | 'DETECTED' | 'CONFIRMED' | 'CANCELLED';
export type FixedCostSource = 'AUTO_DETECTED' | 'USER_DEFINED';

export interface ContractExtensionDto {
  id: string;
  cancelByAt: string | null;
  contractStartedAt: string | null;
  contractHolder: string | null;
  contractNumber: string | null;
  providerName: string | null;
  documentUrl: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FixedCostDto {
  id: string;
  householdId: string;
  name: string;
  merchant: string | null;
  categoryId: string | null;
  amountCents: number;
  cycle: FixedCostCycle;
  nextRenewalAt: string | null;
  confidence: number;
  status: FixedCostStatus;
  source: FixedCostSource;
  detectedFromTransactionIds: string[];
  createdAt: string;
  updatedAt: string;
  contract: ContractExtensionDto | null;
}

export interface CreateFixedCostInput {
  name: string;
  merchant?: string | null;
  categoryId?: string | null;
  amountCents: number;
  cycle: FixedCostCycle;
  nextRenewalAt?: string | null;
  status?: FixedCostStatus;
}

export type UpdateFixedCostInput = Partial<CreateFixedCostInput>;

export interface ContractExtensionInput {
  cancelByAt?: string | null;
  contractStartedAt?: string | null;
  contractHolder?: string | null;
  contractNumber?: string | null;
  providerName?: string | null;
  documentUrl?: string | null;
  notes?: string | null;
}

export interface ListOpts {
  status?: FixedCostStatus;
  source?: FixedCostSource;
  contractsOnly?: boolean;
}

export interface BulkStatusBody {
  ids: string[];
  status: FixedCostStatus;
}

@Injectable({ providedIn: 'root' })
export class FixedCostsService {
  private http = inject(HttpClient);

  private base(householdId: string): string {
    return `/api/v1/households/${householdId}/fixed-costs`;
  }

  list(householdId: string, opts: ListOpts = {}): Observable<FixedCostDto[]> {
    const params: Record<string, string> = {};
    if (opts.status) params['status'] = opts.status;
    if (opts.source) params['source'] = opts.source;
    if (opts.contractsOnly) params['contractsOnly'] = 'true';
    return this.http.get<FixedCostDto[]>(this.base(householdId), { params });
  }

  create(householdId: string, body: CreateFixedCostInput): Observable<FixedCostDto> {
    return this.http.post<FixedCostDto>(this.base(householdId), body);
  }

  update(
    householdId: string,
    id: string,
    body: UpdateFixedCostInput,
  ): Observable<FixedCostDto> {
    return this.http.patch<FixedCostDto>(`${this.base(householdId)}/${id}`, body);
  }

  remove(householdId: string, id: string): Observable<void> {
    return this.http.delete<void>(`${this.base(householdId)}/${id}`);
  }

  recompute(
    householdId: string,
  ): Observable<{ created: number; replaced: number }> {
    return this.http.post<{ created: number; replaced: number }>(
      `${this.base(householdId)}/recompute`,
      {},
    );
  }

  bulkStatus(householdId: string, body: BulkStatusBody): Observable<{ updated: number }> {
    return this.http.post<{ updated: number }>(
      `${this.base(householdId)}/bulk-status`,
      body,
    );
  }

  promoteToContract(
    householdId: string,
    id: string,
    body: ContractExtensionInput,
  ): Observable<FixedCostDto> {
    return this.http.post<FixedCostDto>(
      `${this.base(householdId)}/${id}/contract`,
      body,
    );
  }

  updateContract(
    householdId: string,
    id: string,
    body: ContractExtensionInput,
  ): Observable<FixedCostDto> {
    return this.http.patch<FixedCostDto>(
      `${this.base(householdId)}/${id}/contract`,
      body,
    );
  }

  demoteContract(householdId: string, id: string): Observable<void> {
    return this.http.delete<void>(`${this.base(householdId)}/${id}/contract`);
  }
}
