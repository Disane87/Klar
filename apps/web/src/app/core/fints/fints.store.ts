import { Injectable, computed, inject, resource, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { HouseholdStore } from '../household/household.store';
import {
  FintsService,
  type FintsConnectionResponse,
  type FintsCreateConnectionRequest,
  type FintsCreateConnectionResponse,
  type FintsSyncRunWithChallenge,
  type FintsTanChallenge,
} from './fints.service';

/**
 * FinTS connection store (Phase 14a.6 frontend data layer).
 *
 * Backs the upcoming /app/banks page and setup wizard. Holds:
 *   - the household-scoped connection list
 *   - the active sync run + TAN challenge (transient, drives the modal)
 *   - mutation flags (creating, syncing) for inline button states
 *
 * Mutations always update the resource signal directly (CLAUDE.md rule —
 * no relying on page reload to reflect changes).
 */
@Injectable({ providedIn: 'root' })
export class FintsStore {
  private fintsService = inject(FintsService);
  private householdStore = inject(HouseholdStore);

  private listResource = resource<
    FintsConnectionResponse[] | undefined,
    { householdId: string | null }
  >({
    params: () => ({ householdId: this.householdStore.activeId() }),
    loader: ({ params }) => {
      if (!params.householdId) return Promise.resolve(undefined);
      return firstValueFrom(this.fintsService.list(params.householdId));
    },
  });

  // ── Public readouts ─────────────────────────────────────────────────────────

  readonly connections = this.listResource.value;
  readonly loading = this.listResource.isLoading;
  readonly error = this.listResource.error;

  readonly isEmpty = computed(() => {
    const c = this.connections();
    return !c || c.length === 0;
  });

  readonly hasReauthRequired = computed(() => {
    const c = this.connections();
    return !!c?.some(x => x.status === 'REAUTH_REQUIRED');
  });

  // ── Active sync run / TAN flow state ───────────────────────────────────────

  /** Latest sync run ID we're following — drives polling + TAN modal. */
  readonly activeSyncRunId = signal<string | null>(null);
  readonly activeTanChallenge = signal<FintsTanChallenge | null>(null);
  readonly tanSubmitting = signal(false);

  // ── Mutation flags ─────────────────────────────────────────────────────────

  readonly creating = signal(false);
  readonly syncing = signal<string | null>(null); // connectionId being synced
  readonly deleting = signal<string | null>(null);

  /**
   * Promise of the in-flight create call, if any. Guards against double-
   * creation when a click-handler races the disabled-attribute update or
   * a bug elsewhere triggers a second invocation. Anyone awaiting while a
   * call is in-flight gets the same response — never a fresh POST.
   */
  private inflightCreate: Promise<FintsCreateConnectionResponse> | null = null;

  // ── Public mutations ───────────────────────────────────────────────────────

  async createConnection(
    request: FintsCreateConnectionRequest,
  ): Promise<FintsCreateConnectionResponse> {
    if (this.inflightCreate) return this.inflightCreate;
    const householdId = this.householdStore.activeId();
    if (!householdId) throw new Error('No active household');
    this.creating.set(true);
    this.inflightCreate = (async () => {
      try {
        const result = await firstValueFrom(
          this.fintsService.create(householdId, request),
        );
        // Inject the new connection so the list updates without a reload.
        const current = this.connections() ?? [];
        this.listResource.set([result.connection, ...current]);
        this.activeSyncRunId.set(result.syncRun.id);
        this.activeTanChallenge.set(result.tanChallenge);
        return result;
      } finally {
        this.creating.set(false);
        this.inflightCreate = null;
      }
    })();
    return this.inflightCreate;
  }

  async triggerSync(connectionId: string): Promise<FintsSyncRunWithChallenge> {
    const householdId = this.householdStore.activeId();
    if (!householdId) throw new Error('No active household');
    this.syncing.set(connectionId);
    try {
      const result = await firstValueFrom(
        this.fintsService.triggerSync(householdId, connectionId),
      );
      this.activeSyncRunId.set(result.syncRun.id);
      this.activeTanChallenge.set(result.tanChallenge);
      // Force a list refetch — the connection's lastSyncAt may have moved.
      this.listResource.reload();
      return result;
    } finally {
      this.syncing.set(null);
    }
  }

  async submitTan(syncRunId: string, tan: string): Promise<FintsSyncRunWithChallenge> {
    const householdId = this.householdStore.activeId();
    if (!householdId) throw new Error('No active household');
    this.tanSubmitting.set(true);
    try {
      const result = await firstValueFrom(
        this.fintsService.submitTan(householdId, syncRunId, tan),
      );
      // Bank may chain another TAN — only clear when the run is settled.
      if (result.tanChallenge) {
        this.activeTanChallenge.set(result.tanChallenge);
      } else {
        this.activeTanChallenge.set(null);
        this.activeSyncRunId.set(null);
      }
      this.listResource.reload();
      return result;
    } finally {
      this.tanSubmitting.set(false);
    }
  }

  async deleteConnection(id: string): Promise<void> {
    const householdId = this.householdStore.activeId();
    if (!householdId) throw new Error('No active household');
    this.deleting.set(id);
    try {
      await firstValueFrom(this.fintsService.delete(householdId, id));
      const current = this.connections() ?? [];
      this.listResource.set(current.filter(c => c.id !== id));
    } finally {
      this.deleting.set(null);
    }
  }

  /** Manually clears the TAN challenge — used when the wizard is dismissed. */
  dismissTanFlow(): void {
    this.activeTanChallenge.set(null);
    this.activeSyncRunId.set(null);
  }

  reload(): void {
    this.listResource.reload();
  }
}
