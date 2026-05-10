import { Injectable, computed, inject, resource, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { HouseholdStore } from '../household/household.store';
import {
  FixedCostsService,
  type ContractExtensionInput,
  type CreateFixedCostInput,
  type FixedCostDto,
  type FixedCostStatus,
  type UpdateFixedCostInput,
} from './fixed-costs.service';

@Injectable({ providedIn: 'root' })
export class FixedCostsStore {
  private readonly api = inject(FixedCostsService);
  private readonly householdStore = inject(HouseholdStore);

  readonly statusFilter = signal<FixedCostStatus | null>(null);
  readonly contractsOnly = signal<boolean>(false);
  private readonly tick = signal(0);

  private readonly resource = resource<
    FixedCostDto[] | undefined,
    {
      householdId: string | null;
      status: FixedCostStatus | null;
      contractsOnly: boolean;
      tick: number;
    }
  >({
    params: () => ({
      householdId: this.householdStore.activeId(),
      status: this.statusFilter(),
      contractsOnly: this.contractsOnly(),
      tick: this.tick(),
    }),
    loader: ({ params }) => {
      if (!params.householdId) return Promise.resolve(undefined);
      return firstValueFrom(
        this.api.list(params.householdId, {
          status: params.status ?? undefined,
          contractsOnly: params.contractsOnly,
        }),
      );
    },
  });

  readonly fixedCosts = computed<FixedCostDto[]>(() => this.resource.value() ?? []);
  readonly loading = this.resource.isLoading;
  readonly error = this.resource.error;

  readonly candidates = computed(() => this.fixedCosts().filter(c => c.status === 'CANDIDATE'));
  readonly detected = computed(() => this.fixedCosts().filter(c => c.status === 'DETECTED'));
  readonly confirmed = computed(() => this.fixedCosts().filter(c => c.status === 'CONFIRMED'));
  readonly cancelled = computed(() => this.fixedCosts().filter(c => c.status === 'CANCELLED'));

  /** Active = DETECTED ∪ CONFIRMED — anything actively billing the user. */
  readonly active = computed(() => [...this.detected(), ...this.confirmed()]);

  /** Subset of active fixed costs that have a Contract extension attached. */
  readonly contracts = computed(() => this.active().filter(c => c.contract !== null));

  reload(): void {
    this.tick.update(t => t + 1);
  }

  setStatusFilter(status: FixedCostStatus | null): void {
    this.statusFilter.set(status);
  }

  setContractsOnly(only: boolean): void {
    this.contractsOnly.set(only);
  }

  async create(body: CreateFixedCostInput): Promise<FixedCostDto | null> {
    const householdId = this.householdStore.activeId();
    if (!householdId) return null;
    const created = await firstValueFrom(this.api.create(householdId, body));
    this.reload();
    return created;
  }

  async update(id: string, body: UpdateFixedCostInput): Promise<FixedCostDto | null> {
    const householdId = this.householdStore.activeId();
    if (!householdId) return null;
    const updated = await firstValueFrom(this.api.update(householdId, id, body));
    this.reload();
    return updated;
  }

  async remove(id: string): Promise<void> {
    const householdId = this.householdStore.activeId();
    if (!householdId) return;
    await firstValueFrom(this.api.remove(householdId, id));
    this.reload();
  }

  async recompute(): Promise<{ created: number; replaced: number } | null> {
    const householdId = this.householdStore.activeId();
    if (!householdId) return null;
    const result = await firstValueFrom(this.api.recompute(householdId));
    this.reload();
    return result;
  }

  async bulkStatus(
    ids: readonly string[],
    status: FixedCostStatus,
  ): Promise<{ updated: number } | null> {
    const householdId = this.householdStore.activeId();
    if (!householdId || ids.length === 0) return null;
    const result = await firstValueFrom(
      this.api.bulkStatus(householdId, { ids: [...ids], status }),
    );
    this.reload();
    return result;
  }

  async promoteToContract(
    id: string,
    body: ContractExtensionInput,
  ): Promise<FixedCostDto | null> {
    const householdId = this.householdStore.activeId();
    if (!householdId) return null;
    const updated = await firstValueFrom(this.api.promoteToContract(householdId, id, body));
    this.reload();
    return updated;
  }

  async updateContract(
    id: string,
    body: ContractExtensionInput,
  ): Promise<FixedCostDto | null> {
    const householdId = this.householdStore.activeId();
    if (!householdId) return null;
    const updated = await firstValueFrom(this.api.updateContract(householdId, id, body));
    this.reload();
    return updated;
  }

  async demoteContract(id: string): Promise<void> {
    const householdId = this.householdStore.activeId();
    if (!householdId) return;
    await firstValueFrom(this.api.demoteContract(householdId, id));
    this.reload();
  }
}
