import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mocked } from 'vitest';
import { ConflictException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { AppRole } from '@prisma/client';
import { UsersService } from './users.service';
import type { UsersRepository } from './users.repository';
import type { OidcRepository } from '../oidc/oidc.repository';
import type { RefreshTokenRepository } from '../auth/repositories/refresh-token.repository';
import type { MailService } from '../mail/mail.service';
import type { AuditService } from '../audit/audit.service';
import type { HouseholdsRepository } from '../households/households.repository';
import type { User, OidcIdentity } from '@prisma/client';

vi.mock('argon2', () => ({
  argon2id: 1,
  hash: vi.fn().mockResolvedValue('new-hash'),
  verify: vi.fn().mockResolvedValue(true),
}));

const makeUser = (o: Partial<User> = {}): User => ({
  id: 'u-1', email: 'a@b.com', emailVerified: true,
  displayName: 'Test', passwordHash: 'hashed', appRole: AppRole.USER,
  isDeleted: false, createdAt: new Date(), lastLoginAt: null, ...o,
} as User);

const makeIdentity = (o: Partial<OidcIdentity> = {}): OidcIdentity => ({
  id: 'oi-1', userId: 'u-1', providerName: 'pocketid',
  oidcSub: 'sub-1', email: 'a@b.com',
  createdAt: new Date(), lastLoginAt: null, ...o,
} as OidcIdentity);

const makeRepo = () => ({
  findById: vi.fn(),
  findByEmail: vi.fn(),
  existsByEmail: vi.fn(),
  countAll: vi.fn(),
  create: vi.fn(),
  updateLastLogin: vi.fn(),
  setEmailVerified: vi.fn(),
  setAppRole: vi.fn(),
  setPassword: vi.fn(),
  findWithOidc: vi.fn(),
  updateProfile: vi.fn(),
  softDelete: vi.fn(),
} as unknown as Mocked<UsersRepository>);

let service: UsersService;
let repo: ReturnType<typeof makeRepo>;
let oidcRepo: Mocked<OidcRepository>;
let tokenRepo: Mocked<RefreshTokenRepository>;
let mailService: Mocked<MailService>;
let auditService: Mocked<AuditService>;
let householdsRepo: Mocked<HouseholdsRepository>;

beforeEach(() => {
  repo = makeRepo();
  oidcRepo = {
    findIdentitiesByUser: vi.fn(),
    countIdentitiesByUser: vi.fn(),
    deleteIdentityById: vi.fn(),
  } as unknown as Mocked<OidcRepository>;
  tokenRepo = {
    findActiveByUser: vi.fn(),
    revoke: vi.fn(),
    revokeAllForUser: vi.fn(),
    revokeAllForUserExcept: vi.fn(),
  } as unknown as Mocked<RefreshTokenRepository>;
  mailService = { sendVerificationEmail: vi.fn() } as unknown as Mocked<MailService>;
  auditService = { log: vi.fn() } as unknown as Mocked<AuditService>;
  householdsRepo = {
    countOwnerMemberships: vi.fn(),
  } as unknown as Mocked<HouseholdsRepository>;

  service = new UsersService(
    repo, oidcRepo, tokenRepo, mailService, auditService, householdsRepo,
  );
});

describe('getProfile', () => {
  it('returns UserProfile with hasPassword and oidcIdentities', async () => {
    const user = makeUser();
    const identity = makeIdentity();
    repo.findWithOidc.mockResolvedValue({ ...user, oidcIdentities: [identity] });

    const profile = await service.getProfile('u-1');

    expect(profile.hasPassword).toBe(true);
    expect(profile.oidcIdentities).toHaveLength(1);
    expect(profile.oidcIdentities[0].providerName).toBe('pocketid');
  });

  it('returns hasPassword false when passwordHash is null', async () => {
    const user = makeUser({ passwordHash: null });
    repo.findWithOidc.mockResolvedValue({ ...user, oidcIdentities: [] });

    const profile = await service.getProfile('u-1');
    expect(profile.hasPassword).toBe(false);
  });
});

describe('changePassword', () => {
  it('throws UnauthorizedException when current password is wrong', async () => {
    vi.mocked(argon2.verify).mockResolvedValueOnce(false);
    repo.findById.mockResolvedValue(makeUser());

    await expect(
      service.changePassword('u-1', 'wrong', 'new-pass'),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('hashes new password and revokes all other sessions', async () => {
    vi.mocked(argon2.verify).mockResolvedValueOnce(true);
    repo.findById.mockResolvedValue(makeUser());
    repo.setPassword.mockResolvedValue(undefined as unknown as void);
    tokenRepo.revokeAllForUserExcept.mockResolvedValue(undefined as unknown as void);

    await service.changePassword('u-1', 'correct', 'newpass123', 'rt-current');

    expect(repo.setPassword).toHaveBeenCalledWith('u-1', 'new-hash');
    expect(tokenRepo.revokeAllForUserExcept).toHaveBeenCalledWith('u-1', 'rt-current');
  });
});

describe('unlinkOidc', () => {
  it('throws ConflictException when only one identity and no password', async () => {
    repo.findById.mockResolvedValue(makeUser({ passwordHash: null }));
    oidcRepo.countIdentitiesByUser.mockResolvedValue(1);

    await expect(
      service.unlinkOidc('u-1', 'oi-1'),
    ).rejects.toThrow(ConflictException);
  });

  it('deletes the identity when user has password', async () => {
    repo.findById.mockResolvedValue(makeUser({ passwordHash: 'hashed' }));
    oidcRepo.countIdentitiesByUser.mockResolvedValue(1);
    oidcRepo.deleteIdentityById.mockResolvedValue(undefined as unknown as void);

    await service.unlinkOidc('u-1', 'oi-1');
    expect(oidcRepo.deleteIdentityById).toHaveBeenCalledWith('oi-1', 'u-1');
  });
});

describe('deleteAccount', () => {
  it('throws ConflictException when user is sole owner of a household', async () => {
    householdsRepo.countOwnerMemberships.mockResolvedValue(1);

    await expect(service.deleteAccount('u-1')).rejects.toThrow(ConflictException);
  });

  it('soft-deletes user and revokes all tokens when safe', async () => {
    householdsRepo.countOwnerMemberships.mockResolvedValue(0);
    tokenRepo.revokeAllForUser.mockResolvedValue(undefined as unknown as void);
    repo.softDelete.mockResolvedValue(undefined as unknown as void);

    await service.deleteAccount('u-1');

    expect(tokenRepo.revokeAllForUser).toHaveBeenCalledWith('u-1');
    expect(repo.softDelete).toHaveBeenCalledWith('u-1');
  });
});
