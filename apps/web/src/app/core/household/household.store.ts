import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import type { HouseholdWithRole, Household, HouseholdMember, InviteCode } from '@klar/shared';
import { HouseholdService } from './household.service';

@Injectable({ providedIn: 'root' })
export class HouseholdStore {
  private householdService = inject(HouseholdService);
  private router = inject(Router);

  private _households = signal<HouseholdWithRole[]>([]);
  private _activeId = signal<string | null>(null);
  private _members = signal<HouseholdMember[]>([]);
  private _invites = signal<InviteCode[]>([]);
  private _loading = signal(false);
  private _isInitialized = signal(false);

  readonly households = this._households.asReadonly();
  readonly activeId = this._activeId.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly isInitialized = this._isInitialized.asReadonly();
  readonly members = this._members.asReadonly();
  readonly invites = this._invites.asReadonly();

  readonly activeHousehold = computed<HouseholdWithRole | null>(() => {
    const id = this._activeId();
    return this._households().find(h => h.household.id === id) ?? null;
  });

  readonly activeName = computed(() => this.activeHousehold()?.household.name ?? '');

  readonly activeRole = computed(() => this.activeHousehold()?.role ?? null);

  readonly isOwner = computed(() => this.activeRole() === 'OWNER');

  readonly hasHousehold = computed(() => this._households().length > 0);

  async init(): Promise<void> {
    if (this._isInitialized()) return;
    try {
      await this.loadHouseholds();
    } finally {
      this._isInitialized.set(true);
    }
  }

  async loadHouseholds(): Promise<void> {
    this._loading.set(true);
    try {
      const list = await this.householdService.listMyHouseholds();
      this._households.set(list);

      const currentId = this._activeId();
      const stillExists = list.some(h => h.household.id === currentId);
      if (!stillExists && list.length > 0) {
        this._activeId.set(list[0].household.id);
      } else if (list.length === 0) {
        this._activeId.set(null);
      }
    } finally {
      this._loading.set(false);
    }
  }

  setActiveHousehold(id: string): void {
    this._activeId.set(id);
    this._members.set([]);
    this._invites.set([]);
  }

  async loadMembers(): Promise<void> {
    const id = this._activeId();
    if (!id) return;
    this._members.set(await this.householdService.listMembers(id));
  }

  async loadInvites(): Promise<void> {
    const id = this._activeId();
    if (!id) return;
    this._invites.set(await this.householdService.listInvites(id));
  }

  async createInvite(opts: { expiresInDays?: number; maxUses?: number } = {}): Promise<InviteCode> {
    const id = this._activeId();
    if (!id) throw new Error('Kein aktiver Haushalt');
    const invite = await this.householdService.createInvite(id, opts);
    this._invites.update(list => [invite, ...list]);
    return invite;
  }

  async deleteInvite(inviteId: string): Promise<void> {
    const id = this._activeId();
    if (!id) return;
    await this.householdService.deleteInvite(id, inviteId);
    this._invites.update(list => list.filter(i => i.id !== inviteId));
  }

  async removeMember(userId: string): Promise<void> {
    const id = this._activeId();
    if (!id) return;
    await this.householdService.removeMember(id, userId);
    this._members.update(list => list.filter(m => m.userId !== userId));
  }

  async rename(name: string): Promise<Household> {
    const id = this._activeId();
    if (!id) throw new Error('Kein aktiver Haushalt');
    const updated = await this.householdService.renameHousehold(id, name);
    this._households.update(list =>
      list.map(h =>
        h.household.id === id ? { ...h, household: updated } : h,
      ),
    );
    return updated;
  }

  async joinByCode(code: string): Promise<void> {
    await this.householdService.joinByCode(code);
    await this.loadHouseholds();
    await this.router.navigate(['/app']);
  }
}
