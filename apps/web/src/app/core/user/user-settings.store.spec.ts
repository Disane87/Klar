import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { UserSettingsStore } from './user-settings.store';
import { UserSettingsService } from './user-settings.service';
import { AuthStore } from '../auth/auth.store';
import { vi } from 'vitest';

const mockProfile = {
  id: 'u-1',
  email: 'test@test.com',
  displayName: 'Test',
  hasPassword: true,
  oidcIdentities: [{ id: 'id-1', provider: 'google', email: 'test@test.com' }],
  avatarUrl: null,
  preferences: { locale: 'de', currency: 'EUR', theme: 'dark' },
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
};

const mockSession = {
  id: 's-1',
  tokenId: 'token-1',
  isCurrent: false,
  userAgent: 'Chrome',
  ip: '127.0.0.1',
  createdAt: '2026-01-01',
  expiresAt: '2026-02-01',
};

describe('UserSettingsStore', () => {
  let store: UserSettingsStore;
  let service: { [K in keyof UserSettingsService]: ReturnType<typeof vi.fn> };
  let authStore: { logout: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    service = {
      getProfile: vi.fn().mockResolvedValue(mockProfile),
      updateProfile: vi.fn().mockResolvedValue(mockProfile),
      changePassword: vi.fn().mockResolvedValue(undefined),
      listSessions: vi.fn().mockResolvedValue([mockSession]),
      revokeSession: vi.fn().mockResolvedValue(undefined),
      revokeAllSessions: vi.fn().mockResolvedValue(undefined),
      unlinkOidc: vi.fn().mockResolvedValue(undefined),
      deleteAccount: vi.fn().mockResolvedValue(undefined),
    };

    authStore = { logout: vi.fn().mockResolvedValue(undefined) } as any;

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        UserSettingsStore,
        { provide: UserSettingsService, useValue: service },
        { provide: AuthStore, useValue: authStore },
      ],
    });
    store = TestBed.inject(UserSettingsStore);
  });

  describe('initial state', () => {
    it('should have null profile', () => {
      expect(store.profile()).toBeNull();
    });

    it('should have empty sessions', () => {
      expect(store.sessions()).toEqual([]);
    });

    it('should not be loading', () => {
      expect(store.loading()).toBe(false);
    });
  });

  describe('loadProfile()', () => {
    it('should load profile', async () => {
      await store.loadProfile();
      expect(service.getProfile).toHaveBeenCalled();
      expect(store.profile()).toEqual(mockProfile);
    });

    it('should set loading during load', async () => {
      const promise = store.loadProfile();
      expect(store.loading()).toBe(true);
      await promise;
      expect(store.loading()).toBe(false);
    });
  });

  describe('hasPassword', () => {
    it('should return true when profile has password', async () => {
      await store.loadProfile();
      expect(store.hasPassword()).toBe(true);
    });

    it('should return false when profile has no password', async () => {
      service.getProfile.mockResolvedValueOnce({ ...mockProfile, hasPassword: false });
      await store.loadProfile();
      expect(store.hasPassword()).toBe(false);
    });
  });

  describe('oidcIdentities', () => {
    it('should return identities from profile', async () => {
      await store.loadProfile();
      expect(store.oidcIdentities().length).toBe(1);
    });
  });

  describe('canUnlinkOidc', () => {
    it('should return true when has password', async () => {
      await store.loadProfile();
      expect(store.canUnlinkOidc()).toBe(true);
    });

    it('should return true when multiple OIDC identities', async () => {
      service.getProfile.mockResolvedValueOnce({
        ...mockProfile,
        hasPassword: false,
        oidcIdentities: [
          { id: 'id-1', provider: 'google', email: 'test@test.com' },
          { id: 'id-2', provider: 'github', email: 'test2@test.com' },
        ],
      });
      await store.loadProfile();
      expect(store.canUnlinkOidc()).toBe(true);
    });

    it('should return false when no password and single identity', async () => {
      service.getProfile.mockResolvedValueOnce({ ...mockProfile, hasPassword: false, oidcIdentities: [] });
      await store.loadProfile();
      expect(store.canUnlinkOidc()).toBe(false);
    });
  });

  describe('updateProfile()', () => {
    it('should call service and update profile', async () => {
      await store.loadProfile();
      await store.updateProfile({ displayName: 'New Name' });
      expect(service.updateProfile).toHaveBeenCalledWith({ displayName: 'New Name' });
    });
  });

  describe('loadSessions()', () => {
    it('should load sessions', async () => {
      await store.loadSessions();
      expect(service.listSessions).toHaveBeenCalled();
      expect(store.sessions().length).toBe(1);
    });
  });

  describe('revokeSession()', () => {
    it('should call service and remove session from list', async () => {
      await store.loadSessions();
      await store.revokeSession('s-1');
      expect(service.revokeSession).toHaveBeenCalledWith('s-1');
      expect(store.sessions().length).toBe(0);
    });
  });

  describe('revokeAllSessions()', () => {
    it('should keep current session', async () => {
      const currentSession = { ...mockSession, isCurrent: true };
      service.listSessions.mockResolvedValueOnce([currentSession, mockSession]);
      await store.loadSessions();
      await store.revokeAllSessions();
      expect(store.sessions().length).toBe(1);
      expect(store.sessions()[0].isCurrent).toBe(true);
    });
  });

  describe('unlinkOidc()', () => {
    it('should call service and remove identity', async () => {
      await store.loadProfile();
      await store.unlinkOidc('id-1');
      expect(service.unlinkOidc).toHaveBeenCalledWith('id-1');
    });
  });

  describe('deleteAccount()', () => {
    it('should call service and logout', async () => {
      await store.deleteAccount();
      expect(service.deleteAccount).toHaveBeenCalled();
      expect(authStore.logout).toHaveBeenCalled();
    });
  });
});