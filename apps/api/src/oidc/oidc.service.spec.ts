import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ForbiddenException,
  BadRequestException,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { OidcService } from './oidc.service';
import type { OidcRepository } from './oidc.repository';
import type { UsersService } from '../users/users.service';
import type { HouseholdsService } from '../households/households.service';
import type { CategoriesService } from '../categories/categories.service';
import type { AuditService } from '../audit/audit.service';
import type { ConfigService } from '@nestjs/config';
import type { User, OidcIdentity, OidcLoginState, OneTimeHandoverCode } from '@prisma/client';
import { AppRole } from '@prisma/client';

vi.mock('openid-client', () => ({
  Issuer: { discover: vi.fn() },
  generators: {
    state: vi.fn().mockReturnValue('mock-state'),
    codeVerifier: vi.fn().mockReturnValue('mock-verifier'),
    codeChallenge: vi.fn().mockReturnValue('mock-challenge'),
  },
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const makeUser = (overrides: Partial<User> = {}): User => ({
  id: 'user-1',
  email: 'test@example.com',
  emailVerified: true,
  displayName: 'Test User',
  passwordHash: 'hashed',
  appRole: AppRole.USER,
  isDeleted: false,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  lastLoginAt: null,
  totpSecret: null,
  totpEnabled: false,
  avatarUrl: null,
  ...overrides,
});

const makeIdentity = (overrides: Partial<OidcIdentity> = {}): OidcIdentity => ({
  id: 'identity-1',
  userId: 'user-1',
  providerName: 'pocketid',
  oidcSub: 'sub-123',
  email: 'test@example.com',
  lastLoginAt: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  ...overrides,
});

const makeLoginState = (overrides: Partial<OidcLoginState> = {}): OidcLoginState => ({
  id: 'state-1',
  providerName: 'pocketid',
  state: 'mock-state',
  codeVerifier: 'mock-verifier',
  redirectAfterLogin: null,
  expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  createdAt: new Date(),
  ...overrides,
});

const makeHandoverCode = (overrides: Partial<OneTimeHandoverCode> = {}): OneTimeHandoverCode => ({
  id: 'code-1',
  code: 'deadbeef'.repeat(8),
  userId: 'user-1',
  expiresAt: new Date(Date.now() + 60 * 1000),
  usedAt: null,
  createdAt: new Date(),
  ...overrides,
});

// ── Config defaults ───────────────────────────────────────────────────────────

const configValues: Record<string, unknown> = {
  'oidc.enabled': true,
  'oidc.providerName': 'pocketid',
  'oidc.issuerUrl': 'https://id.example.com',
  'oidc.clientId': 'client-id',
  'oidc.clientSecret': 'secret',
  'oidc.redirectUri': 'https://app.example.com/auth/oidc/callback',
  'oidc.scopes': ['openid', 'email', 'profile'],
  'oidc.requiredGroup': '',
  'oidc.adminGroup': '',
  'oidc.autoJoinHouseholdId': '',
};

// ── Factory ───────────────────────────────────────────────────────────────────

function buildService(configOverrides: Record<string, unknown> = {}): {
  service: OidcService;
  oidcRepo: OidcRepository;
  usersService: UsersService;
  householdsService: HouseholdsService;
  categoriesService: CategoriesService;
  auditService: AuditService;
  configService: ConfigService;
} {
  const merged = { ...configValues, ...configOverrides };

  const configService = {
    get: vi.fn((key: string) => merged[key]),
  } as unknown as ConfigService;

  const oidcRepo = {
    findIdentity: vi.fn(),
    findIdentitiesByUser: vi.fn(),
    countIdentitiesByUser: vi.fn(),
    createIdentity: vi.fn(),
    updateIdentityLastLogin: vi.fn(),
    deleteIdentity: vi.fn(),
    createLoginState: vi.fn(),
    findLoginState: vi.fn(),
    deleteLoginState: vi.fn(),
    cleanExpiredStates: vi.fn(),
    createHandoverCode: vi.fn(),
    findHandoverCode: vi.fn(),
    markHandoverCodeUsed: vi.fn(),
    cleanExpiredCodes: vi.fn(),
  } as unknown as OidcRepository;

  const usersService = {
    findByEmail: vi.fn(),
    findByIdOrThrow: vi.fn(),
    countAll: vi.fn(),
    create: vi.fn(),
    updateLastLogin: vi.fn(),
    setAppRole: vi.fn(),
  } as unknown as UsersService;

  const householdsService = {
    createDefault: vi.fn().mockResolvedValue({ id: 'household-1', name: 'Mein Haushalt' }),
    ensureMembership: vi.fn().mockResolvedValue(undefined),
  } as unknown as HouseholdsService;

  const categoriesService = {
    seedDefaults: vi.fn().mockResolvedValue(undefined),
  } as unknown as CategoriesService;

  const auditService = {
    log: vi.fn(),
  } as unknown as AuditService;

  const service = new OidcService(
    configService,
    oidcRepo,
    usersService,
    householdsService,
    categoriesService,
    auditService,
  );

  return {
    service,
    oidcRepo,
    usersService,
    householdsService,
    categoriesService,
    auditService,
    configService,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('OidcService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── isEnabled ────────────────────────────────────────────────────────────────

  describe('isEnabled', () => {
    it('returns true when oidc.enabled is true', () => {
      const { service } = buildService({ 'oidc.enabled': true });
      expect(service.isEnabled()).toBe(true);
    });

    it('returns false when oidc.enabled is false', () => {
      const { service } = buildService({ 'oidc.enabled': false });
      expect(service.isEnabled()).toBe(false);
    });
  });

  // ── getAuthorizeUrl ───────────────────────────────────────────────────────────

  describe('getAuthorizeUrl', () => {
    it('throws ForbiddenException when OIDC is disabled', async () => {
      const { service } = buildService({ 'oidc.enabled': false });
      await expect(service.getAuthorizeUrl()).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when client is not initialized (onModuleInit not called)', async () => {
      // Client is null because onModuleInit was never awaited in this unit test
      const { service } = buildService({ 'oidc.enabled': true });
      await expect(service.getAuthorizeUrl()).rejects.toThrow(BadRequestException);
    });
  });

  // ── handleCallback ────────────────────────────────────────────────────────────

  describe('handleCallback', () => {
    it('throws ForbiddenException when OIDC is disabled', async () => {
      const { service } = buildService({ 'oidc.enabled': false });
      await expect(service.handleCallback('code', 'state')).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when state is not found in repository', async () => {
      const { service, oidcRepo } = buildService({ 'oidc.enabled': true });
      vi.mocked(oidcRepo.findLoginState).mockResolvedValue(null);

      await expect(service.handleCallback('code', 'unknown-state')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when state is expired', async () => {
      const { service, oidcRepo } = buildService({ 'oidc.enabled': true });
      const expiredState = makeLoginState({ expiresAt: new Date(Date.now() - 1000) });
      vi.mocked(oidcRepo.findLoginState).mockResolvedValue(expiredState);
      vi.mocked(oidcRepo.deleteLoginState).mockResolvedValue(undefined);

      await expect(service.handleCallback('code', 'mock-state')).rejects.toThrow(
        BadRequestException,
      );
      expect(oidcRepo.deleteLoginState).toHaveBeenCalledWith(expiredState.id);
    });
  });

  // ── exchangeHandoverCode ──────────────────────────────────────────────────────

  describe('exchangeHandoverCode', () => {
    it('throws UnauthorizedException when code is not found', async () => {
      const { service, oidcRepo } = buildService();
      vi.mocked(oidcRepo.findHandoverCode).mockResolvedValue(null);

      await expect(service.exchangeHandoverCode('nonexistent')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException when code has already been used (usedAt is not null)', async () => {
      const { service, oidcRepo } = buildService();
      const usedCode = makeHandoverCode({ usedAt: new Date() });
      vi.mocked(oidcRepo.findHandoverCode).mockResolvedValue(usedCode);

      await expect(service.exchangeHandoverCode(usedCode.code)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException when code is expired', async () => {
      const { service, oidcRepo } = buildService();
      const expiredCode = makeHandoverCode({ expiresAt: new Date(Date.now() - 1000), usedAt: null });
      vi.mocked(oidcRepo.findHandoverCode).mockResolvedValue(expiredCode);

      await expect(service.exchangeHandoverCode(expiredCode.code)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('returns user on a valid, unused, non-expired code', async () => {
      const { service, oidcRepo, usersService } = buildService();
      const validCode = makeHandoverCode();
      const user = makeUser();
      vi.mocked(oidcRepo.findHandoverCode).mockResolvedValue(validCode);
      vi.mocked(oidcRepo.markHandoverCodeUsed).mockResolvedValue(undefined);
      vi.mocked(usersService.findByIdOrThrow).mockResolvedValue(user);

      const result = await service.exchangeHandoverCode(validCode.code);

      expect(oidcRepo.markHandoverCodeUsed).toHaveBeenCalledWith(validCode.id);
      expect(usersService.findByIdOrThrow).toHaveBeenCalledWith(validCode.userId);
      expect(result).toBe(user);
    });
  });

  // ── unlinkIdentity ────────────────────────────────────────────────────────────

  describe('unlinkIdentity', () => {
    it('throws NotFoundException when identity is not found for the given provider', async () => {
      const { service, oidcRepo } = buildService();
      vi.mocked(oidcRepo.findIdentitiesByUser).mockResolvedValue([]);

      await expect(service.unlinkIdentity('user-1', 'pocketid')).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when user has no password and no other identities', async () => {
      const { service, oidcRepo, usersService } = buildService();
      const identity = makeIdentity({ providerName: 'pocketid' });
      vi.mocked(oidcRepo.findIdentitiesByUser).mockResolvedValue([identity]);
      vi.mocked(usersService.findByIdOrThrow).mockResolvedValue(
        makeUser({ passwordHash: null }),
      );

      await expect(service.unlinkIdentity('user-1', 'pocketid')).rejects.toThrow(
        ConflictException,
      );
    });

    it('succeeds and deletes the identity when user has a password', async () => {
      const { service, oidcRepo, usersService, auditService } = buildService();
      const identity = makeIdentity({ providerName: 'pocketid' });
      vi.mocked(oidcRepo.findIdentitiesByUser).mockResolvedValue([identity]);
      vi.mocked(usersService.findByIdOrThrow).mockResolvedValue(
        makeUser({ passwordHash: 'hashed-password' }),
      );
      vi.mocked(oidcRepo.deleteIdentity).mockResolvedValue(undefined);

      await service.unlinkIdentity('user-1', 'pocketid');

      expect(oidcRepo.deleteIdentity).toHaveBeenCalledWith('user-1', 'pocketid');
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'user.oidc_unlink', userId: 'user-1' }),
      );
    });
  });
});
