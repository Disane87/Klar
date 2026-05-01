import { Injectable, computed, inject, resource, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { HouseholdStore } from '../household/household.store';
import { OverviewService } from './overview.service';
import type { ProjectsOverview } from './overview.service';

@Injectable({ providedIn: 'root' })
export class ProjekteStore {
  private overviewService = inject(OverviewService);
  private householdStore  = inject(HouseholdStore);

  readonly statusFilter = signal<string>('ACTIVE');

  // ── Projects resource — reloads when householdId or status changes ────────────
  private projectsResource = resource<ProjectsOverview | undefined, { householdId: string | null; status: string }>({
    params: () => ({
      householdId: this.householdStore.activeId(),
      status:      this.statusFilter(),
    }),
    loader: ({ params }) => {
      if (!params.householdId) return Promise.resolve(undefined);
      const statusParam = params.status === 'ALL' ? undefined : params.status;
      return firstValueFrom(
        this.overviewService.getProjects(params.householdId, statusParam)
      );
    },
  });

  // ── Public signals ────────────────────────────────────────────────────────────
  readonly projects = this.projectsResource.value;

  readonly loading = computed(() => this.projectsResource.isLoading());

  readonly error = computed(() => this.projectsResource.error());

  readonly isEmpty = computed(() => {
    const data = this.projects();
    return !data || data.projects.length === 0;
  });

  // ── Actions ───────────────────────────────────────────────────────────────────
  setStatusFilter(status: string): void {
    this.statusFilter.set(status);
  }

  reload(): void {
    this.projectsResource.reload();
  }
}
