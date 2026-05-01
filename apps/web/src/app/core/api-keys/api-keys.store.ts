import { Injectable, computed, inject, resource, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { HouseholdStore } from '../household/household.store';
import { ApiKeysService, type ApiKeyListItem } from './api-keys.service';

export const AVAILABLE_SCOPES = [
  'transactions:read',
  'transactions:write',
  'categories:read',
  'overview:read',
  'projects:read',
] as const;

export type ApiScope = (typeof AVAILABLE_SCOPES)[number];

@Injectable({ providedIn: 'root' })
export class ApiKeysStore {
  private apiKeysService = inject(ApiKeysService);
  private householdStore = inject(HouseholdStore);

  // ── List resource — reloads when householdId changes ─────────────────────────
  private listResource = resource<ApiKeyListItem[] | undefined, { householdId: string | null }>({
    params: () => ({ householdId: this.householdStore.activeId() }),
    loader: ({ params }) => {
      if (!params.householdId) return Promise.resolve(undefined);
      return firstValueFrom(this.apiKeysService.list(params.householdId));
    },
  });

  // ── Public signals ────────────────────────────────────────────────────────────
  readonly keys    = this.listResource.value;
  readonly loading = this.listResource.isLoading;
  readonly error   = this.listResource.error;

  // ── Create form signals ───────────────────────────────────────────────────────
  readonly newKeyName   = signal('');
  readonly newKeyScopes = signal<string[]>(['transactions:read', 'overview:read']);
  readonly creating     = signal(false);

  // ── Signal for displaying the new key (shown once) ───────────────────────────
  readonly justCreatedKey = signal<string | null>(null);

  // ── Create form visibility ────────────────────────────────────────────────────
  readonly showCreateForm = signal(false);

  // ── Computed ──────────────────────────────────────────────────────────────────
  readonly isEmpty = computed(() => {
    const keys = this.keys();
    return !keys || keys.length === 0;
  });

  // ── Actions ───────────────────────────────────────────────────────────────────
  async createKey(): Promise<void> {
    const householdId = this.householdStore.activeId();
    if (!householdId) return;

    const name = this.newKeyName().trim();
    if (!name) return;

    this.creating.set(true);
    try {
      const response = await firstValueFrom(
        this.apiKeysService.create(householdId, {
          name,
          scopes: this.newKeyScopes(),
        }),
      );
      this.justCreatedKey.set(response.fullKey);
      this.newKeyName.set('');
      this.newKeyScopes.set(['transactions:read', 'overview:read']);
      this.showCreateForm.set(false);
      this.listResource.reload();
    } finally {
      this.creating.set(false);
    }
  }

  async revokeKey(id: string): Promise<void> {
    const householdId = this.householdStore.activeId();
    if (!householdId) return;
    await firstValueFrom(this.apiKeysService.revoke(householdId, id));
    this.listResource.reload();
  }

  async deleteKey(id: string): Promise<void> {
    const householdId = this.householdStore.activeId();
    if (!householdId) return;
    await firstValueFrom(this.apiKeysService.delete(householdId, id));
    this.listResource.reload();
  }

  clearJustCreated(): void {
    this.justCreatedKey.set(null);
  }

  toggleScope(scope: string): void {
    const current = this.newKeyScopes();
    if (current.includes(scope)) {
      this.newKeyScopes.set(current.filter(s => s !== scope));
    } else {
      this.newKeyScopes.set([...current, scope]);
    }
  }

  reload(): void {
    this.listResource.reload();
  }
}
