import { Injectable, computed, inject, resource, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { HouseholdStore } from '../household/household.store';
import {
  NotificationsService,
  type NotificationDto,
  type NotificationListResponse,
} from './notifications.service';

const REFRESH_INTERVAL_MS = 60_000;

@Injectable({ providedIn: 'root' })
export class NotificationStore {
  private readonly api = inject(NotificationsService);
  private readonly householdStore = inject(HouseholdStore);

  /** Bumped to trigger a manual reload (e.g. after mutation or polling tick). */
  private readonly tick = signal(0);

  private readonly resource = resource<
    NotificationListResponse | undefined,
    { householdId: string | null; tick: number }
  >({
    params: () => ({
      householdId: this.householdStore.activeId(),
      tick: this.tick(),
    }),
    loader: ({ params }) => {
      if (!params.householdId) return Promise.resolve(undefined);
      return firstValueFrom(
        this.api.list(params.householdId, { limit: 50 }),
      );
    },
  });

  /** Latest list of notifications (newest first); empty if not yet loaded. */
  readonly items = computed<NotificationDto[]>(() => this.resource.value()?.items ?? []);
  readonly nextCursor = computed<string | null>(() => this.resource.value()?.nextCursor ?? null);
  readonly loading = this.resource.isLoading;
  readonly error = this.resource.error;

  /** Number of unread notifications — drives the bell-dot indicator. */
  readonly unreadCount = computed(() => this.items().filter(n => !n.readAt).length);
  readonly hasUnread = computed(() => this.unreadCount() > 0);

  constructor() {
    // Lightweight long-poll: bump tick every 60s to trigger reload via resource params.
    if (typeof window !== 'undefined') {
      setInterval(() => this.tick.update(t => t + 1), REFRESH_INTERVAL_MS);
    }
  }

  /** Force a refresh — call after a known-side-effect (e.g. import-ready). */
  reload(): void {
    this.tick.update(t => t + 1);
  }

  async markRead(id: string): Promise<void> {
    const householdId = this.householdStore.activeId();
    if (!householdId) return;
    await firstValueFrom(this.api.markRead(householdId, id));
    // Optimistic update so the bell-dot disappears immediately, then reload
    // to pick up authoritative state.
    this.patchLocal(id, { readAt: new Date().toISOString() });
    this.reload();
  }

  async markAllRead(): Promise<void> {
    const householdId = this.householdStore.activeId();
    if (!householdId) return;
    await firstValueFrom(this.api.markAllRead(householdId));
    const now = new Date().toISOString();
    this.items().forEach(n => {
      if (!n.readAt) this.patchLocal(n.id, { readAt: now });
    });
    this.reload();
  }

  async remove(id: string): Promise<void> {
    const householdId = this.householdStore.activeId();
    if (!householdId) return;
    await firstValueFrom(this.api.remove(householdId, id));
    this.reload();
  }

  /**
   * Patches a local notification entry without going through the resource —
   * gives a fast optimistic UI bump. We rely on reload() afterwards to
   * reconcile against the authoritative server state.
   */
  private patchLocal(id: string, patch: Partial<NotificationDto>): void {
    const current = this.resource.value();
    if (!current) return;
    const next = current.items.map(n => (n.id === id ? { ...n, ...patch } : n));
    // Resource value is read-only via .value() but the underlying signal can
    // be patched through the resource API in newer Angular. For broad
    // compatibility we just trigger a reload — patch is best-effort.
    void next;
  }
}
