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
  code: 'ABCD1234',
  householdId: 'hh-1',
  createdAt: '2026-01-01',
  expiresAt: '2026-05-07',
  usesRemaining: null,
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
      post: vi.fn().mockReturnValue(of({ householdId: 'hh-1' })),
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
      const result = await service.listMyHouseholds();
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
      const result = await service.listMembers('hh-1');
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
      await service.createInvite('hh-1', { maxUses: 5 });
      expect(httpClient.post).toHaveBeenCalledWith('/api/v1/households/hh-1/invites', { maxUses: 5 });
    });
  });

  describe('deleteInvite()', () => {
    it('should DELETE invite', async () => {
      await service.deleteInvite('hh-1', 'inv-1');
      expect(httpClient.delete).toHaveBeenCalledWith('/api/v1/households/hh-1/invites/inv-1');
    });
  });

  describe('joinByCode()', () => {
    it('should POST join code', async () => {
      await service.joinByCode('ABCD1234');
      expect(httpClient.post).toHaveBeenCalledWith('/api/v1/households/join', { code: 'ABCD1234' });
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