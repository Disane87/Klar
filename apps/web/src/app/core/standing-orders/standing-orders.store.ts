import { Injectable, computed, inject, resource, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { HouseholdStore } from '../household/household.store';

export type StandingOrderFrequency =
  | 'WEEKLY'
  | 'MONTHLY'
  | 'QUARTERLY'
  | 'HALF_YEARLY'
  | 'YEARLY'
  | 'CUSTOM'
  | 'UNKNOWN';

export type StandingOrderSource = 'FINTS_DERIVED' | 'MANUAL';

// Mirrors Prisma's TransactionKind. Only the two values that reach
// StandingOrder records are surfaced in the UI; the others are accepted
// in the type for forward compatibility but never expected on a row.
export type StandingOrderTransactionKind =
  | 'STANDING_ORDER'
  | 'DIRECT_DEBIT'
  | 'TRANSFER'
  | 'CARD'
  | 'FEE'
  | 'OTHER';

export interface StandingOrder {
  id: string;
  householdId: string;
  accountId: string;
  source: StandingOrderSource;
  /** NULL on MANUAL records; on FINTS_DERIVED rows reflects the source booking kind. */
  transactionKind: StandingOrderTransactionKind | null;
  counterpartyName: string | null;
  counterpartyIban: string | null;
  amountCents: number;
  currency: string;
  frequency: StandingOrderFrequency;
  lastSeenAt: string | null;
  nextExpectedAt: string | null;
  categoryId: string | null;
  note: string | null;
  isActive: boolean;
  bankFieldsLockedAt: string | null;
  firstSeenAt: string;
  /** Raw bank label (e.g. "FOLGELASTSCHRIFT"); UI title-cases via formatBookingText. */
  bookingText: string | null;
}

export interface CreateStandingOrderInput {
  accountId: string;
  counterpartyName?: string | null;
  counterpartyIban?: string | null;
  amountCents: number;
  currency?: string;
  frequency: StandingOrderFrequency;
  nextExpectedAt?: string | null;
  categoryId?: string | null;
  note?: string | null;
}

export interface UpdateStandingOrderInput {
  categoryId?: string | null;
  note?: string | null;
  isActive?: boolean;
  counterpartyName?: string | null;
  counterpartyIban?: string | null;
  amountCents?: number;
  frequency?: StandingOrderFrequency;
  nextExpectedAt?: string | null;
}

@Injectable({ providedIn: 'root' })
export class StandingOrdersStore {
  private http = inject(HttpClient);
  private householdStore = inject(HouseholdStore);

  readonly includeInactive = signal(false);

  private _resource = resource<
    StandingOrder[],
    { hid: string | null; includeInactive: boolean }
  >({
    params: () => ({
      hid: this.householdStore.activeId(),
      includeInactive: this.includeInactive(),
    }),
    loader: ({ params }) => {
      if (!params.hid) return Promise.resolve([] as StandingOrder[]);
      const queryParams: Record<string, string> = {};
      if (params.includeInactive) {
        queryParams['includeInactive'] = 'true';
      }
      return firstValueFrom(
        this.http.get<StandingOrder[]>(
          `/api/v1/households/${params.hid}/standing-orders`,
          { params: queryParams },
        ),
      );
    },
  });

  readonly items = this._resource.value;
  readonly isLoading = this._resource.isLoading;
  readonly error = this._resource.error;
  readonly isEmpty = computed(() => (this.items()?.length ?? 0) === 0);

  reload(): void {
    this._resource.reload();
  }

  async create(input: CreateStandingOrderInput): Promise<StandingOrder> {
    const hid = this.householdStore.activeId();
    if (!hid) throw new Error('No active household');
    const created = await firstValueFrom(
      this.http.post<StandingOrder>(
        `/api/v1/households/${hid}/standing-orders`,
        input,
      ),
    );
    this._resource.reload();
    return created;
  }

  async update(id: string, patch: UpdateStandingOrderInput): Promise<StandingOrder> {
    const hid = this.householdStore.activeId();
    if (!hid) throw new Error('No active household');
    const updated = await firstValueFrom(
      this.http.patch<StandingOrder>(
        `/api/v1/households/${hid}/standing-orders/${id}`,
        patch,
      ),
    );
    this._resource.reload();
    return updated;
  }

  async remove(id: string): Promise<void> {
    const hid = this.householdStore.activeId();
    if (!hid) throw new Error('No active household');
    await firstValueFrom(
      this.http.delete(`/api/v1/households/${hid}/standing-orders/${id}`),
    );
    this._resource.reload();
  }
}
