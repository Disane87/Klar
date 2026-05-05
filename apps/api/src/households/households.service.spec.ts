import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  NotFoundException,
} from '@nestjs/common';
import { HouseholdRole } from '@prisma/client';
import { HouseholdsService } from './households.service';
import type { HouseholdsRepository } from './households.repository';
import type { InvitationLinkRepository } from './invitation-link.repository';
import type { UsersRepository } from '../users/users.repository';
import type { AuditService } from '../audit/audit.service';
import type { MailService } from '../mail/mail.service';
import type { Household, HouseholdMembership } from '@prisma/client';

// Local type mirroring InvitationLink until Prisma client regenerates
type InvitationLink = {
  id: string;
  householdId: string;
  token: string;
  email: string | null;
  createdByUserId: string | null;
  expiresAt: Date | null;
  usedAt: Date | null;
  usedByUserId: string | null;
  createdAt: Date;
};

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

const makeInviteLink = (overrides: Partial<InvitationLink> = {}): InvitationLink => ({
  id: 'inv-1',
  householdId: 'h-1',
  token: 'abc123token',
  email: null,
  createdByUserId: 'u-1',
  expiresAt: new Date(Date.now() + 7 * 86_400_000),
  usedAt: null,
  usedByUserId: null,
  createdAt: new Date(),
  ...overrides,
});

const makeRepo = (): HouseholdsRepository =>
  ({
    createWithOwner: vi.fn(),
    findById: vi.fn(),
    findMembership: vi.fn(),
    findCallerWithUser: vi.fn(),
    findMembershipsByUser: vi.fn(),
    findMembershipsByHousehold: vi.fn(),
    addMember: vi.fn(),
    removeMember: vi.fn(),
    updateName: vi.fn(),
    countOwners: vi.fn(),
    countMembers: vi.fn(),
    updateMemberRole: vi.fn(),
    deleteHousehold: vi.fn(),
    seedDefaultTemplates: vi.fn(),
  }) as unknown as HouseholdsRepository;

const makeInviteLinkRepo = (): InvitationLinkRepository =>
  ({
    create: vi.fn(),
    findByToken: vi.fn(),
    findByHousehold: vi.fn(),
    consumeAndJoin: vi.fn(),
    updateEmail: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn(),
    deleteByHousehold: vi.fn(),
  }) as unknown as InvitationLinkRepository;

const makeAudit = (): AuditService =>
  ({ log: vi.fn() }) as unknown as AuditService;

const makeMailService = (): MailService =>
  ({ sendInviteEmail: vi.fn() }) as unknown as MailService;

const makeUsersRepo = (): UsersRepository =>
  ({ existsByEmail: vi.fn().mockResolvedValue(false) }) as unknown as UsersRepository;

const makeCtx = (overrides: object = {}) => ({
  userId: 'u-1',
  householdId: 'h-1',
  source: 'web' as const,
  ...overrides,
});

const fakeAppConfig = { frontendUrl: 'http://localhost:4200', registrationEnabled: true };

let repo: HouseholdsRepository;
let inviteLinkRepo: InvitationLinkRepository;
let usersRepo: UsersRepository;
let audit: AuditService;
let mailService: MailService;
let service: HouseholdsService;

beforeEach(() => {
  repo = makeRepo();
  inviteLinkRepo = makeInviteLinkRepo();
  usersRepo = makeUsersRepo();
  audit = makeAudit();
  mailService = makeMailService();
  service = new HouseholdsService(
    repo,
    inviteLinkRepo,
    usersRepo,
    audit,
    mailService,
    fakeAppConfig as never,
  );
});

describe('HouseholdsService', () => {
  describe('createDefault', () => {
    it('creates household with default name when none provided', async () => {
      vi.mocked(repo.createWithOwner).mockResolvedValue(makeHousehold());
      vi.mocked(repo.seedDefaultTemplates).mockResolvedValue(undefined);

      const result = await service.createDefault('u-1');

      expect(repo.createWithOwner).toHaveBeenCalledWith({ name: 'Mein Haushalt', ownerId: 'u-1' });
      expect(result.id).toBe('h-1');
    });

    it('uses provided name when given', async () => {
      vi.mocked(repo.createWithOwner).mockResolvedValue(makeHousehold({ name: 'Custom Name' }));
      vi.mocked(repo.seedDefaultTemplates).mockResolvedValue(undefined);

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

  describe('createInviteLink', () => {
    it('throws ForbiddenException when caller is not OWNER', async () => {
      vi.mocked(repo.findMembership).mockResolvedValue(
        makeMembership({ role: HouseholdRole.MEMBER }),
      );

      await expect(service.createInviteLink(makeCtx())).rejects.toThrow(ForbiddenException);
    });

    it('creates invite link when caller is OWNER', async () => {
      vi.mocked(repo.findMembership).mockResolvedValue(makeMembership({ role: HouseholdRole.OWNER }));
      vi.mocked(inviteLinkRepo.create).mockResolvedValue(makeInviteLink());

      const result = await service.createInviteLink(makeCtx());

      expect(result.token).toBe('abc123token');
      expect(result.link).toContain('/join/abc123token');
      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'member.invited' }));
    });
  });

  describe('joinByToken', () => {
    it('throws NotFoundException for unknown token', async () => {
      vi.mocked(inviteLinkRepo.consumeAndJoin).mockRejectedValue(new Error('INVITE_NOT_FOUND'));

      await expect(service.joinByToken('u-2', 'badtoken')).rejects.toThrow(NotFoundException);
    });

    it('throws GoneException for used token', async () => {
      vi.mocked(inviteLinkRepo.consumeAndJoin).mockRejectedValue(new Error('INVITE_USED'));

      await expect(service.joinByToken('u-2', 'badtoken')).rejects.toThrow(GoneException);
    });

    it('throws GoneException for expired token', async () => {
      vi.mocked(inviteLinkRepo.consumeAndJoin).mockRejectedValue(new Error('INVITE_EXPIRED'));

      await expect(service.joinByToken('u-2', 'badtoken')).rejects.toThrow(GoneException);
    });

    it('throws BadRequestException when already a member', async () => {
      vi.mocked(inviteLinkRepo.consumeAndJoin).mockRejectedValue(new Error('ALREADY_MEMBER'));

      await expect(service.joinByToken('u-2', 'badtoken')).rejects.toThrow(BadRequestException);
    });

    it('joins successfully with valid token', async () => {
      vi.mocked(inviteLinkRepo.consumeAndJoin).mockResolvedValue({ householdId: 'h-1' });
      vi.mocked(repo.findMembership).mockResolvedValue(makeMembership({ userId: 'u-2' }));

      const result = await service.joinByToken('u-2', 'abc123token');

      expect(result.userId).toBe('u-2');
      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'member.joined' }));
    });
  });

  describe('changeRole', () => {
    it('throws ForbiddenException when caller is not owner', async () => {
      (repo.findMembership as ReturnType<typeof vi.fn>).mockResolvedValue(
        makeMembership({ role: HouseholdRole.MEMBER }),
      );

      await expect(
        service.changeRole(
          makeCtx({ userId: 'u-1' }),
          'u-2',
          HouseholdRole.OWNER,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when caller tries to change own role', async () => {
      (repo.findMembership as ReturnType<typeof vi.fn>).mockResolvedValue(
        makeMembership({ userId: 'u-1', role: HouseholdRole.OWNER }),
      );

      await expect(
        service.changeRole(
          makeCtx({ userId: 'u-1' }),
          'u-1',
          HouseholdRole.MEMBER,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ConflictException when demoting last owner', async () => {
      (repo.findMembership as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(makeMembership({ userId: 'u-1', role: HouseholdRole.OWNER }))
        .mockResolvedValueOnce(makeMembership({ userId: 'u-2', role: HouseholdRole.OWNER }));
      (repo as unknown as { countOwners: ReturnType<typeof vi.fn> }).countOwners = vi.fn().mockResolvedValue(1);
      (repo as unknown as { updateMemberRole: ReturnType<typeof vi.fn> }).updateMemberRole = vi.fn();

      await expect(
        service.changeRole(
          makeCtx({ userId: 'u-1' }),
          'u-2',
          HouseholdRole.MEMBER,
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('getInviteInfo', () => {
    it('throws NotFoundException for unknown token', async () => {
      vi.mocked(inviteLinkRepo.findByToken).mockResolvedValue(null);

      await expect(service.getInviteInfo('unknown')).rejects.toThrow(NotFoundException);
    });

    it('throws GoneException for used invite', async () => {
      vi.mocked(inviteLinkRepo.findByToken).mockResolvedValue(
        makeInviteLink({ usedAt: new Date() }),
      );

      await expect(service.getInviteInfo('abc123token')).rejects.toThrow(GoneException);
    });

    it('throws GoneException for expired invite', async () => {
      vi.mocked(inviteLinkRepo.findByToken).mockResolvedValue(
        makeInviteLink({ expiresAt: new Date(Date.now() - 1000) }),
      );

      await expect(service.getInviteInfo('abc123token')).rejects.toThrow(GoneException);
    });

    it('returns household info for valid invite', async () => {
      vi.mocked(inviteLinkRepo.findByToken).mockResolvedValue(makeInviteLink());
      vi.mocked(repo.findById).mockResolvedValue(makeHousehold());

      const result = await service.getInviteInfo('abc123token');

      expect(result.householdName).toBe('Mein Haushalt');
    });
  });
});
