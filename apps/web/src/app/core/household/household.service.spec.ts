import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { provideHttpClient } from '@angular/common/http';
import { HouseholdService } from './household.service';
import { vi } from 'vitest';
import { of } from 'rxjs';

const mockHousehold = {
  id: 'hh-1',
  name: 'Test HH',
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
};

const mockMember = {
  userId: 'u-1',
  householdId: 'hh-1',
  displayName: 'Alice',
  email: 'alice@test.com',
  role: 'MEMBER',
  joinedAt: '2026-01-01',
};

const mockInvite = {
  id: 'inv-1',
  householdId: 'hh-1',
  token: 'abc123token',
  email: null,
  createdByUserId: 'u-1',
  expiresAt: '2026-05-07',
  usedAt: null,
  usedByUserId: null,
  createdAt: '2026-01-01',
  link: 'https://klar.app/join/abc123token',
};

describe('HouseholdService', () => {
  let service: HouseholdService;
  let httpClient: {
    get: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
    patch: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    httpClient = {
      get: vi.fn().mockReturnValue(of([mockHousehold])),
      post: vi.fn().mockReturnValue(of({ householdId: 'hh-1', id: 'm-1' })),
      patch: vi.fn().mockReturnValue(of(mockHousehold)),
      delete: vi.fn().mockReturnValue(of(undefined)),
    };

    TestBed.configureTestingModule({
      providers: [
        HouseholdService,
        { provide: HttpClient, useValue: httpClient },
      ],
    });
    service = TestBed.inject(HouseholdService);
  });

  describe('listMyHouseholds()', () => {
    it('should GET households', async () => {
      await service.listMyHouseholds();
      expect(httpClient.get).toHaveBeenCalledWith('/api/v1/households');
    });
  });

  describe('getHousehold()', () => {
    it('should GET single household', async () => {
      await service.getHousehold('hh-1');
      expect(httpClient.get).toHaveBeenCalledWith('/api/v1/households/hh-1');
    });
  });

  describe('renameHousehold()', () => {
    it('should PATCH household name', async () => {
      await service.renameHousehold('hh-1', 'New Name');
      expect(httpClient.patch).toHaveBeenCalledWith('/api/v1/households/hh-1', { name: 'New Name' });
    });
  });

  describe('listMembers()', () => {
    it('should GET members', async () => {
      httpClient.get.mockReturnValue(of([mockMember]));
      await service.listMembers('hh-1');
      expect(httpClient.get).toHaveBeenCalledWith('/api/v1/households/hh-1/members');
    });
  });

  describe('removeMember()', () => {
    it('should DELETE member', async () => {
      await service.removeMember('hh-1', 'u-1');
      expect(httpClient.delete).toHaveBeenCalledWith('/api/v1/households/hh-1/members/u-1');
    });
  });

  describe('changeMemberRole()', () => {
    it('should PATCH member role', async () => {
      await service.changeMemberRole('hh-1', 'u-1', 'OWNER');
      expect(httpClient.patch).toHaveBeenCalledWith('/api/v1/households/hh-1/members/u-1', { role: 'OWNER' });
    });
  });

  describe('listInvites()', () => {
    it('should GET invites', async () => {
      httpClient.get.mockReturnValue(of([mockInvite]));
      await service.listInvites('hh-1');
      expect(httpClient.get).toHaveBeenCalledWith('/api/v1/households/hh-1/invites');
    });
  });

  describe('createInvite()', () => {
    it('should POST invite', async () => {
      httpClient.post.mockReturnValue(of(mockInvite));
      await service.createInvite('hh-1', { expiresInDays: 7 });
      expect(httpClient.post).toHaveBeenCalledWith('/api/v1/households/hh-1/invites', { expiresInDays: 7 });
    });
  });

  describe('deleteInvite()', () => {
    it('should DELETE invite', async () => {
      await service.deleteInvite('hh-1', 'inv-1');
      expect(httpClient.delete).toHaveBeenCalledWith('/api/v1/households/hh-1/invites/inv-1');
    });
  });

  describe('sendInviteEmail()', () => {
    it('should POST invite email', async () => {
      await service.sendInviteEmail('hh-1', 'inv-1', 'alice@test.com');
      expect(httpClient.post).toHaveBeenCalledWith(
        '/api/v1/households/hh-1/invites/inv-1/send',
        { email: 'alice@test.com' },
      );
    });
  });

  describe('getInviteInfo()', () => {
    it('should GET invite info by token', async () => {
      httpClient.get.mockReturnValue(of({ householdName: 'Test HH', expiresAt: null }));
      await service.getInviteInfo('abc123token');
      expect(httpClient.get).toHaveBeenCalledWith('/api/v1/join/abc123token');
    });
  });

  describe('joinByToken()', () => {
    it('should POST join by token', async () => {
      await service.joinByToken('abc123token');
      expect(httpClient.post).toHaveBeenCalledWith('/api/v1/join/abc123token', {});
    });
  });

  describe('leaveHousehold()', () => {
    it('should DELETE leave', async () => {
      await service.leaveHousehold('hh-1');
      expect(httpClient.delete).toHaveBeenCalledWith('/api/v1/households/hh-1/leave');
    });
  });

  describe('deleteHousehold()', () => {
    it('should DELETE household', async () => {
      await service.deleteHousehold('hh-1');
      expect(httpClient.delete).toHaveBeenCalledWith('/api/v1/households/hh-1');
    });
  });
});
