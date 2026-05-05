import { Injectable, computed, inject, resource } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type {
  Category,
  CreateCategoryRequest,
  UpdateCategoryRequest,
} from '@klar/shared';
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
          `/api/v1/households/${params.householdId}/categories?includeArchived=true`,
        ),
      );
    },
  });

  readonly all      = computed(() => this._resource.value() ?? []);
  readonly active   = computed(() => this.all().filter(c => !c.isArchived));
  readonly archived = computed(() => this.all().filter(c => c.isArchived));
  readonly loading  = this._resource.isLoading;
  readonly error    = this._resource.error;

  reload(): void {
    this._resource.reload();
  }

  async create(input: CreateCategoryRequest): Promise<Category> {
    const householdId = this.householdStore.activeId();
    if (!householdId) throw new Error('Kein aktiver Haushalt');
    const created = await firstValueFrom(
      this.http.post<Category>(`/api/v1/households/${householdId}/categories`, input),
    );
    this._resource.reload();
    return created;
  }

  async update(id: string, input: UpdateCategoryRequest): Promise<Category> {
    const householdId = this.householdStore.activeId();
    if (!householdId) throw new Error('Kein aktiver Haushalt');
    const updated = await firstValueFrom(
      this.http.patch<Category>(`/api/v1/households/${householdId}/categories/${id}`, input),
    );
    this._resource.reload();
    return updated;
  }

  async remove(id: string): Promise<void> {
    const householdId = this.householdStore.activeId();
    if (!householdId) throw new Error('Kein aktiver Haushalt');
    await firstValueFrom(
      this.http.delete<void>(`/api/v1/households/${householdId}/categories/${id}`),
    );
    this._resource.reload();
  }
}
