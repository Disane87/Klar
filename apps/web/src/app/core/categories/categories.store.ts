import { Injectable, computed, inject, resource } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type { Category } from '@klar/shared';
import { HouseholdStore } from '../household/household.store';

@Injectable({ providedIn: 'root' })
export class CategoriesStore {
  private http           = inject(HttpClient);
  private householdStore = inject(HouseholdStore);

  private _resource = resource<Category[], { householdId: string | null }>({
    params: () => ({ householdId: this.householdStore.activeId() }),
    loader: ({ params }) => {
      if (!params.householdId) return Promise.resolve([]);
      return firstValueFrom(
        this.http.get<Category[]>(
          `/api/v1/households/${params.householdId}/categories`,
        ),
      );
    },
  });

  readonly all     = computed(() => this._resource.value() ?? []);
  readonly active  = computed(() => this.all().filter(c => !c.isArchived));
  readonly loading = this._resource.isLoading;
  readonly error   = this._resource.error;
}
