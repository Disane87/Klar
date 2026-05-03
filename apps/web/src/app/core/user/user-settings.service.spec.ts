import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { provideHttpClient } from '@angular/common/http';
import { UserSettingsService } from './user-settings.service';
import { vi } from 'vitest';
import { of } from 'rxjs';

const mockProfile = {
  id: 'u-1',
  email: 'test@test.com',
  displayName: 'Test User',
  avatarUrl: null,
  preferences: {
    locale: 'de',
    currency: 'EUR',
    theme: 'dark',
  },
  identities: [],
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
};

const mockSession = {
  tokenId: 'token-1',
  userAgent: 'Chrome 120',
  ip: '192.168.1.1',
  createdAt: '2026-05-01',
  expiresAt: '2026-06-01',
};

describe('UserSettingsService', () => {
  let service: UserSettingsService;
  let httpClient: {
    get: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
    patch: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    httpClient = {
      get: vi.fn().mockReturnValue(of(mockProfile)),
      post: vi.fn().mockReturnValue(of(undefined)),
      patch: vi.fn().mockReturnValue(of(mockProfile)),
      delete: vi.fn().mockReturnValue(of(undefined)),
    };

    TestBed.configureTestingModule({
      providers: [
        UserSettingsService,
        { provide: HttpClient, useValue: httpClient },
      ],
    });
    service = TestBed.inject(UserSettingsService);
  });

  describe('getProfile()', () => {
    it('should GET profile', async () => {
      const result = await service.getProfile();
      expect(httpClient.get).toHaveBeenCalledWith('/api/v1/users/me');
      expect(result).toEqual(mockProfile);
    });
  });

  describe('updateProfile()', () => {
    it('should PATCH profile', async () => {
      const dto = { displayName: 'New Name' };
      const result = await service.updateProfile(dto);
      expect(httpClient.patch).toHaveBeenCalledWith('/api/v1/users/me', dto);
      expect(result).toEqual(mockProfile);
    });
  });

  describe('changePassword()', () => {
    it('should POST to change-password endpoint', async () => {
      const dto = { currentPassword: 'old', newPassword: 'new' };
      await service.changePassword(dto);
      expect(httpClient.post).toHaveBeenCalledWith('/api/v1/users/me/change-password', dto);
    });
  });

  describe('listSessions()', () => {
    it('should GET sessions', async () => {
      httpClient.get.mockReturnValue(of([mockSession]));
      const result = await service.listSessions();
      expect(httpClient.get).toHaveBeenCalledWith('/api/v1/users/me/sessions');
      expect(result).toEqual([mockSession]);
    });
  });

  describe('revokeSession()', () => {
    it('should DELETE specific session', async () => {
      await service.revokeSession('token-1');
      expect(httpClient.delete).toHaveBeenCalledWith('/api/v1/users/me/sessions/token-1');
    });
  });

  describe('revokeAllSessions()', () => {
    it('should DELETE all sessions', async () => {
      await service.revokeAllSessions();
      expect(httpClient.delete).toHaveBeenCalledWith('/api/v1/users/me/sessions');
    });
  });

  describe('unlinkOidc()', () => {
    it('should DELETE OIDC identity', async () => {
      await service.unlinkOidc('idp-1');
      expect(httpClient.delete).toHaveBeenCalledWith('/api/v1/users/me/oidc/idp-1');
    });
  });

  describe('deleteAccount()', () => {
    it('should DELETE account', async () => {
      await service.deleteAccount();
      expect(httpClient.delete).toHaveBeenCalledWith('/api/v1/users/me');
    });
  });
});