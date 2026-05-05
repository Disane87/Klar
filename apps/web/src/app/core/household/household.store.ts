import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import type { HouseholdWithRole, Household, HouseholdMember, InvitationLink } from '@klar/shared';
import { HouseholdService } from './household.service';

@Injectable({ providedIn: 'root' })
export class HouseholdStore {
  private householdService = inject(HouseholdService);
  private router = inject(Router);

  private _households = signal<HouseholdWithRole[]>([]);
  private _activeId = signal<string | null>(null);
  private _members = signal<HouseholdMember[]>([]);
  private _invites = signal<InvitationLink[]>([]);
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

  async createInvite(opts: { expiresInDays?: number } = {}): Promise<InvitationLink> {
    const id = this._activeId();
    if (!id) throw new Error('Kein aktiver Haushalt');
    const invite = await this.householdService.createInvite(id, opts);
    this._invites.update(list => [invite, ...list]);
    return invite;
  }

  async sendInviteEmail(inviteId: string, email: string): Promise<void> {
    const id = this._activeId();
    if (!id) return;
    await this.householdService.sendInviteEmail(id, inviteId, email);
    const lower = email.toLowerCase();
    this._invites.update(list =>
      list.map(i => (i.id === inviteId ? { ...i, email: lower } : i)),
    );
  }

  async joinByToken(token: string): Promise<void> {
    await this.householdService.joinByToken(token);
    await this.loadHouseholds();
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

  async changeRole(userId: string, role: 'OWNER' | 'MEMBER'): Promise<void> {
    const id = this._activeId();
    if (!id) return;
    await this.householdService.changeMemberRole(id, userId, role);
    await this.loadMembers();
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

  async leave(): Promise<void> {
    const id = this._activeId();
    if (!id) return;
    await this.householdService.leaveHousehold(id);
    this._households.update(list => list.filter(h => h.household.id !== id));
    this._members.set([]);
    this._invites.set([]);
    const remaining = this._households();
    if (remaining.length > 0) {
      this._activeId.set(remaining[0].household.id);
      await this.router.navigate(['/app']);
    } else {
      this._activeId.set(null);
      await this.router.navigate(['/onboarding']);
    }
  }

  async deleteActiveHousehold(): Promise<void> {
    const id = this._activeId();
    if (!id) return;
    await this.householdService.deleteHousehold(id);
    this._households.update(list => list.filter(h => h.household.id !== id));
    this._members.set([]);
    this._invites.set([]);
    const remaining = this._households();
    if (remaining.length > 0) {
      this._activeId.set(remaining[0].household.id);
      await this.router.navigate(['/app']);
    } else {
      this._activeId.set(null);
      await this.router.navigate(['/onboarding']);
    }
  }
}
