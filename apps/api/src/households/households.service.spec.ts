import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { HouseholdRole } from '@prisma/client';
import { HouseholdsService } from './households.service';
import type { HouseholdsRepository } from './households.repository';
import type { InviteCodeRepository } from './invite-code.repository';
import type { AuditService } from '../audit/audit.service';
import type { Household, HouseholdMembership, InviteCode } from '@prisma/client';

const makeHousehold = (overrides: Partial<Household> = {}): Household => ({
  id: 'h-1',
  name: 'Mein Haushalt',
  createdAt: new Date(),
  ...overrides,
});

const makeMembership = (
  overrides: Partial<HouseholdMembership> = {},
): HouseholdMembership => ({
  id: 'mem-1',
  userId: 'u-1',
  householdId: 'h-1',
  role: HouseholdRole.OWNER,
  joinedAt: new Date(),
  ...overrides,
});

const makeInvite = (overrides: Partial<InviteCode> = {}): InviteCode => ({
  id: 'inv-1',
  householdId: 'h-1',
  code: 'ABCD1234',
  createdByUserId: 'u-1',
  expiresAt: null,
  usesRemaining: null,
  createdAt: new Date(),
  ...overrides,
});

const makeRepo = (): HouseholdsRepository =>
  ({
    createWithOwner: vi.fn(),
    findById: vi.fn(),
    findMembership: vi.fn(),
    findMembershipsByUser: vi.fn(),
    findMembershipsByHousehold: vi.fn(),
    addMember: vi.fn(),
    removeMember: vi.fn(),
    updateName: vi.fn(),
  }) as unknown as HouseholdsRepository;

const makeInviteRepo = (): InviteCodeRepository =>
  ({
    create: vi.fn(),
    findByCode: vi.fn(),
    findByHousehold: vi.fn(),
    consumeAndJoin: vi.fn(),
    delete: vi.fn(),
  }) as unknown as InviteCodeRepository;

const makeAudit = (): AuditService =>
  ({ log: vi.fn() }) as unknown as AuditService;

const makeCtx = (overrides: object = {}) => ({
  userId: 'u-1',
  householdId: 'h-1',
  source: 'web' as const,
  ...overrides,
});

let repo: HouseholdsRepository;
let inviteRepo: InviteCodeRepository;
let audit: AuditService;
let service: HouseholdsService;

beforeEach(() => {
  repo = makeRepo();
  inviteRepo = makeInviteRepo();
  audit = makeAudit();
  service = new HouseholdsService(repo, inviteRepo, audit);
});

describe('HouseholdsService', () => {
  describe('createDefault', () => {
    it('creates household with default name when none provided', async () => {
      vi.mocked(repo.createWithOwner).mockResolvedValue(makeHousehold());

      const result = await service.createDefault('u-1');

      expect(repo.createWithOwner).toHaveBeenCalledWith({ name: 'Mein Haushalt', ownerId: 'u-1' });
      expect(result.id).toBe('h-1');
    });

    it('uses provided name when given', async () => {
      vi.mocked(repo.createWithOwner).mockResolvedValue(makeHousehold({ name: 'Custom Name' }));

      await service.createDefault('u-1', 'Custom Name');

      expect(repo.createWithOwner).toHaveBeenCalledWith({ name: 'Custom Name', ownerId: 'u-1' });
    });
  });

  describe('getHousehold', () => {
    it('returns the household when it exists', async () => {
      vi.mocked(repo.findById).mockResolvedValue(makeHousehold());

      const result = await service.getHousehold(makeCtx());

      expect(result.id).toBe('h-1');
    });

    it('throws NotFoundException when household not found', async () => {
      vi.mocked(repo.findById).mockResolvedValue(null);

      await expect(service.getHousehold(makeCtx())).rejects.toThrow(NotFoundException);
    });
  });

  describe('rename', () => {
    it('updates household name and logs audit', async () => {
      vi.mocked(repo.updateName).mockResolvedValue(makeHousehold({ name: 'New Name' }));

      const result = await service.rename(makeCtx(), 'New Name');

      expect(repo.updateName).toHaveBeenCalledWith('h-1', 'New Name');
      expect(result.name).toBe('New Name');
      expect(audit.log).toHaveBeenCalled();
    });

    it('throws BadRequestException for empty name', async () => {
      await expect(service.rename(makeCtx(), '  ')).rejects.toThrow(BadRequestException);
    });
  });

  describe('removeMember', () => {
    it('throws ForbiddenException when trying to remove self', async () => {
      await expect(service.removeMember(makeCtx({ userId: 'u-1' }), 'u-1'))
        .rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when caller is not OWNER', async () => {
      vi.mocked(repo.findMembership).mockResolvedValue(
        makeMembership({ role: HouseholdRole.MEMBER }),
      );

      await expect(service.removeMember(makeCtx(), 'u-2')).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when target is not a member', async () => {
      vi.mocked(repo.findMembership)
        .mockResolvedValueOnce(makeMembership({ role: HouseholdRole.OWNER }))
        .mockResolvedValueOnce(null);

      await expect(service.removeMember(makeCtx(), 'u-2')).rejects.toThrow(NotFoundException);
    });

    it('removes member successfully when caller is OWNER', async () => {
      vi.mocked(repo.findMembership)
        .mockResolvedValueOnce(makeMembership({ role: HouseholdRole.OWNER }))
        .mockResolvedValueOnce(makeMembership({ userId: 'u-2', role: HouseholdRole.MEMBER }));

      await service.removeMember(makeCtx(), 'u-2');

      expect(repo.removeMember).toHaveBeenCalledWith('u-2', 'h-1');
      expect(audit.log).toHaveBeenCalled();
    });
  });

  describe('createInvite', () => {
    it('throws ForbiddenException when caller is not OWNER', async () => {
      vi.mocked(repo.findMembership).mockResolvedValue(
        makeMembership({ role: HouseholdRole.MEMBER }),
      );

      await expect(service.createInvite(makeCtx())).rejects.toThrow(ForbiddenException);
    });

    it('creates invite when caller is OWNER', async () => {
      vi.mocked(repo.findMembership).mockResolvedValue(makeMembership({ role: HouseholdRole.OWNER }));
      vi.mocked(inviteRepo.create).mockResolvedValue(makeInvite());

      const result = await service.createInvite(makeCtx());

      expect(result.code).toBe('ABCD1234');
      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'member.invited' }));
    });
  });

  describe('joinByCode', () => {
    it('throws NotFoundException for unknown code', async () => {
      vi.mocked(inviteRepo.consumeAndJoin).mockRejectedValue(new Error('INVITE_NOT_FOUND'));

      await expect(service.joinByCode('u-2', 'XXXX1234')).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException for expired code', async () => {
      vi.mocked(inviteRepo.consumeAndJoin).mockRejectedValue(new Error('INVITE_EXPIRED'));

      await expect(service.joinByCode('u-2', 'XXXX1234')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when already a member', async () => {
      vi.mocked(inviteRepo.consumeAndJoin).mockRejectedValue(new Error('ALREADY_MEMBER'));

      await expect(service.joinByCode('u-2', 'XXXX1234')).rejects.toThrow(BadRequestException);
    });

    it('normalizes code (strips dashes, uppercases) before joining', async () => {
      vi.mocked(inviteRepo.consumeAndJoin).mockResolvedValue({ householdId: 'h-1' });
      vi.mocked(repo.findMembership).mockResolvedValue(makeMembership({ userId: 'u-2' }));

      await service.joinByCode('u-2', 'abcd-1234');

      expect(inviteRepo.consumeAndJoin).toHaveBeenCalledWith('ABCD1234', 'u-2');
    });
  });
});
