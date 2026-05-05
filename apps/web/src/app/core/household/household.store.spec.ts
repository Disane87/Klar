import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { HouseholdStore } from './household.store';
import { HouseholdService } from './household.service';
import type { HouseholdWithRole, HouseholdMember, InviteCode } from '@klar/shared';

const makeHousehold = (id = 'hh-1', name = 'Test HH'): HouseholdWithRole => ({
  household: { id, name, createdAt: '2026-01-01', updatedAt: '2026-01-01' },
  role: 'OWNER',
});

const makeMember = (userId = 'u-1'): HouseholdMember => ({
  userId,
  householdId: 'hh-1',
  displayName: 'Alice',
  email: 'alice@test.com',
  role: 'MEMBER',
  joinedAt: '2026-01-01',
});

const makeInvite = (id = 'inv-1'): InviteCode => ({
  id,
  code: 'ABCD1234',
  householdId: 'hh-1',
  createdAt: '2026-01-01',
  expiresAt: '2026-05-07',
  usesRemaining: null,
});

describe('HouseholdStore', () => {
  let store: HouseholdStore;
  let svc: { [K in keyof HouseholdService]: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    svc = {
      listMyHouseholds: vi.fn().mockResolvedValue([makeHousehold()]),
      getHousehold:     vi.fn(),
      renameHousehold:  vi.fn(),
      listMembers:      vi.fn().mockResolvedValue([makeMember()]),
      removeMember:     vi.fn().mockResolvedValue(undefined),
      listInvites:      vi.fn().mockResolvedValue([makeInvite()]),
      createInvite:     vi.fn().mockResolvedValue(makeInvite('inv-new')),
      deleteInvite:     vi.fn().mockResolvedValue(undefined),
      sendInviteEmail:  vi.fn().mockResolvedValue(undefined),
      joinByCode:       vi.fn().mockResolvedValue({ householdId: 'hh-2' }),
    };

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        HouseholdStore,
        { provide: HouseholdService, useValue: svc },
      ],
    });
    store = TestBed.inject(HouseholdStore);
  });

  describe('init()', () => {
    it('loads households and sets activeId', async () => {
      await TestBed.runInInjectionContext(() => store.init());
      expect(store.households()).toHaveLength(1);
      expect(store.activeId()).toBe('hh-1');
      expect(store.hasHousehold()).toBe(true);
    });

    it('only loads once when called repeatedly', async () => {
      await TestBed.runInInjectionContext(() => store.init());
      await TestBed.runInInjectionContext(() => store.init());
      expect(svc.listMyHouseholds).toHaveBeenCalledTimes(1);
    });

    it('sets hasHousehold to false when list is empty', async () => {
      svc.listMyHouseholds.mockResolvedValue([]);
      await TestBed.runInInjectionContext(() => store.init());
      expect(store.hasHousehold()).toBe(false);
      expect(store.activeId()).toBeNull();
    });
  });

  describe('computed signals', () => {
    it('activeName returns empty string with no household', () => {
      expect(store.activeName()).toBe('');
    });

    it('isOwner returns false with no household', () => {
      expect(store.isOwner()).toBe(false);
    });

    it('activeHousehold returns null with no household', () => {
      expect(store.activeHousehold()).toBeNull();
    });
  });

  describe('after init', () => {
    beforeEach(async () => {
      await TestBed.runInInjectionContext(() => store.init());
    });

    it('activeName returns household name', () => {
      expect(store.activeName()).toBe('Test HH');
    });

    it('isOwner returns true', () => {
      expect(store.isOwner()).toBe(true);
    });

    it('activeHousehold returns the active household', () => {
      expect(store.activeHousehold()?.household.id).toBe('hh-1');
    });
  });

  describe('setActiveHousehold()', () => {
    it('switches the active household and clears members/invites', async () => {
      await TestBed.runInInjectionContext(() => store.init());
      svc.listMembers.mockResolvedValue([makeMember()]);
      await store.loadMembers();
      expect(store.members()).toHaveLength(1);

      store.setActiveHousehold('hh-2');
      expect(store.activeId()).toBe('hh-2');
      expect(store.members()).toHaveLength(0);
      expect(store.invites()).toHaveLength(0);
    });
  });

  describe('loadMembers()', () => {
    it('does nothing without an active household', async () => {
      await store.loadMembers();
      expect(svc.listMembers).not.toHaveBeenCalled();
    });

    it('loads members for the active household', async () => {
      await TestBed.runInInjectionContext(() => store.init());
      await store.loadMembers();
      expect(store.members()).toHaveLength(1);
      expect(store.members()[0].userId).toBe('u-1');
    });
  });

  describe('loadInvites()', () => {
    it('does nothing without an active household', async () => {
      await store.loadInvites();
      expect(svc.listInvites).not.toHaveBeenCalled();
    });

    it('loads invites for the active household', async () => {
      await TestBed.runInInjectionContext(() => store.init());
      await store.loadInvites();
      expect(store.invites()).toHaveLength(1);
    });
  });

  describe('createInvite()', () => {
    it('throws without an active household', async () => {
      await expect(store.createInvite()).rejects.toThrow();
    });

    it('prepends new invite to the list', async () => {
      await TestBed.runInInjectionContext(() => store.init());
      await store.loadInvites();
      const newInvite = await store.createInvite({ expiresInDays: 7 });
      expect(newInvite.id).toBe('inv-new');
      expect(store.invites()[0].id).toBe('inv-new');
    });
  });

  describe('deleteInvite()', () => {
    it('removes the invite from the list', async () => {
      await TestBed.runInInjectionContext(() => store.init());
      await store.loadInvites();
      await store.deleteInvite('inv-1');
      expect(store.invites()).toHaveLength(0);
    });
  });

  describe('sendInviteEmail()', () => {
    it('patches the matching invite with the lowercased email', async () => {
      await TestBed.runInInjectionContext(() => store.init());
      await store.loadInvites();
      await store.sendInviteEmail('inv-1', 'Alice@Example.COM');
      expect(svc.sendInviteEmail).toHaveBeenCalledWith('hh-1', 'inv-1', 'Alice@Example.COM');
      const updated = store.invites().find(i => i.id === 'inv-1');
      expect(updated?.email).toBe('alice@example.com');
    });
  });

  describe('removeMember()', () => {
    it('removes the member from the list', async () => {
      await TestBed.runInInjectionContext(() => store.init());
      await store.loadMembers();
      await store.removeMember('u-1');
      expect(store.members()).toHaveLength(0);
    });
  });

  describe('rename()', () => {
    it('throws without an active household', async () => {
      await expect(store.rename('New Name')).rejects.toThrow();
    });

    it('updates the household name in the list', async () => {
      const updated = { id: 'hh-1', name: 'Renamed', createdAt: '', updatedAt: '' };
      svc.renameHousehold.mockResolvedValue(updated);
      await TestBed.runInInjectionContext(() => store.init());
      await store.rename('Renamed');
      expect(store.activeName()).toBe('Renamed');
    });
  });
});
