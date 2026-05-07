import { Injectable, computed, inject, resource, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { currentYearMonth, type BudgetVsActualRow } from '@klar/shared';
import { HouseholdStore } from '../household/household.store';
import { OverviewService } from './overview.service';

@Injectable({ providedIn: 'root' })
export class BudgetVsActualsStore {
  private overviewService = inject(OverviewService);
  private householdStore  = inject(HouseholdStore);

  private readonly month = signal<string>(currentYearMonth());

  setMonth(m: string): void {
    this.month.set(m);
  }

  private _resource = resource<BudgetVsActualRow[] | undefined, { householdId: string | null; month: string }>({
    params: () => ({
      householdId: this.householdStore.activeId(),
      month:       this.month(),
    }),
    loader: ({ params }) => {
      if (!params.householdId) return Promise.resolve(undefined);
      return firstValueFrom(
        this.overviewService.getBudgetsVsActuals(params.householdId, params.month),
      ).then((r) => r.rows);
    },
  });

  readonly rows    = computed<BudgetVsActualRow[]>(() => this._resource.value() ?? []);
  readonly loading = this._resource.isLoading;
  readonly error   = this._resource.error;

  reload(): void {
    this._resource.reload();
  }
}
