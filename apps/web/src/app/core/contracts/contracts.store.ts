import { Injectable, computed, inject, resource, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { HouseholdStore } from '../household/household.store';
import {
  ContractsService,
  type ContractDto,
  type ContractStatus,
  type CreateContractInput,
  type UpdateContractInput,
} from './contracts.service';

@Injectable({ providedIn: 'root' })
export class ContractsStore {
  private readonly api = inject(ContractsService);
  private readonly householdStore = inject(HouseholdStore);

  readonly statusFilter = signal<ContractStatus | null>(null);
  private readonly tick = signal(0);

  private readonly resource = resource<
    ContractDto[] | undefined,
    { householdId: string | null; status: ContractStatus | null; tick: number }
  >({
    params: () => ({
      householdId: this.householdStore.activeId(),
      status: this.statusFilter(),
      tick: this.tick(),
    }),
    loader: ({ params }) => {
      if (!params.householdId) return Promise.resolve(undefined);
      return firstValueFrom(
        this.api.list(params.householdId, params.status ?? undefined),
      );
    },
  });

  readonly contracts = computed<ContractDto[]>(() => this.resource.value() ?? []);
  readonly loading = this.resource.isLoading;
  readonly error = this.resource.error;

  readonly candidates = computed(() => this.contracts().filter(c => c.status === 'CANDIDATE'));
  readonly detected = computed(() => this.contracts().filter(c => c.status === 'DETECTED'));
  readonly confirmed = computed(() => this.contracts().filter(c => c.status === 'CONFIRMED'));
  readonly cancelled = computed(() => this.contracts().filter(c => c.status === 'CANCELLED'));

  /** Active = DETECTED ∪ CONFIRMED — i.e. anything actually billing the user. */
  readonly active = computed(() => [...this.detected(), ...this.confirmed()]);

  reload(): void {
    this.tick.update(t => t + 1);
  }

  setStatusFilter(status: ContractStatus | null): void {
    this.statusFilter.set(status);
  }

  async create(body: CreateContractInput): Promise<ContractDto | null> {
    const householdId = this.householdStore.activeId();
    if (!householdId) return null;
    const created = await firstValueFrom(this.api.create(householdId, body));
    this.reload();
    return created;
  }

  async update(id: string, body: UpdateContractInput): Promise<ContractDto | null> {
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

  async recompute(): Promise<{ count: number } | null> {
    const householdId = this.householdStore.activeId();
    if (!householdId) return null;
    const result = await firstValueFrom(this.api.recompute(householdId));
    this.reload();
    return result;
  }
}
