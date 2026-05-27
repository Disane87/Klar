import { Injectable, computed, inject, resource, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { HouseholdStore } from '../household/household.store';
import {
  NotificationRulesService,
  type CreateNotificationRuleInput,
  type NotificationRuleDto,
  type UpdateNotificationRuleInput,
} from './notification-rules.service';

@Injectable({ providedIn: 'root' })
export class NotificationRulesStore {
  private readonly api = inject(NotificationRulesService);
  private readonly householdStore = inject(HouseholdStore);

  private readonly tick = signal(0);

  private readonly listResource = resource<
    NotificationRuleDto[] | undefined,
    { householdId: string | null; tick: number }
  >({
    params: () => ({
      householdId: this.householdStore.activeId(),
      tick: this.tick(),
    }),
    loader: ({ params }) => {
      if (!params.householdId) return Promise.resolve(undefined);
      return firstValueFrom(this.api.list(params.householdId));
    },
  });

  readonly items = computed<NotificationRuleDto[]>(() => this.listResource.value() ?? []);
  readonly loading = this.listResource.isLoading;
  readonly error = this.listResource.error;

  reload(): void {
    this.tick.update(t => t + 1);
  }

  async create(input: CreateNotificationRuleInput): Promise<NotificationRuleDto> {
    const householdId = this.requireHouseholdId();
    const rule = await firstValueFrom(this.api.create(householdId, input));
    this.reload();
    return rule;
  }

  async update(
    id: string,
    input: UpdateNotificationRuleInput,
  ): Promise<NotificationRuleDto> {
    const householdId = this.requireHouseholdId();
    const rule = await firstValueFrom(this.api.update(householdId, id, input));
    this.reload();
    return rule;
  }

  async remove(id: string): Promise<void> {
    const householdId = this.requireHouseholdId();
    await firstValueFrom(this.api.remove(householdId, id));
    this.reload();
  }

  async test(id: string): Promise<void> {
    const householdId = this.requireHouseholdId();
    await firstValueFrom(this.api.test(householdId, id));
    this.reload();
  }

  private requireHouseholdId(): string {
    const id = this.householdStore.activeId();
    if (!id) throw new Error('Kein aktiver Haushalt');
    return id;
  }
}
