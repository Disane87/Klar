import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ConflictException,
  ForbiddenException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { AuthService } from './auth.service';
import type { UsersService } from '../users/users.service';
import type { HouseholdsService } from '../households/households.service';
import type { MailService } from '../mail/mail.service';
import type { AuditService } from '../audit/audit.service';
import type { RefreshTokenRepository } from './repositories/refresh-token.repository';
import type { EmailVerificationRepository } from './repositories/email-verification.repository';
import type { JwtService } from '@nestjs/jwt';
import type { ConfigService } from '@nestjs/config';
import type { User, EmailVerification, RefreshToken } from '@prisma/client';
import { AppRole } from '@prisma/client';

vi.mock('argon2', () => ({
  argon2id: 1,
  hash: vi.fn().mockResolvedValue('mocked-hash'),
  verify: vi.fn().mockResolvedValue(true),
}));

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
  ...overrides,
});

const makeVerification = (overrides: Partial<EmailVerification> = {}): EmailVerification => ({
  id: 'verif-1',
  userId: 'user-1',
  token: 'token-abc',
  expiresAt: new Date(Date.now() + 86400000),
  createdAt: new Date(),
  ...overrides,
});

const makeRefreshToken = (overrides: Partial<RefreshToken> = {}): RefreshToken => ({
  id: 'rt-1',
  userId: 'user-1',
  tokenHash: 'some-hash',
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  revokedAt: null,
  userAgent: null,
  ip: null,
  createdAt: new Date(),
  ...overrides,
});

const fakeReq = { ip: '127.0.0.1', headers: {} as Record<string, string> };

function buildService(): {
  service: AuthService;
  usersService: UsersService;
  householdsService: HouseholdsService;
  mailService: MailService;
  auditService: AuditService;
  jwtService: JwtService;
  configService: ConfigService;
  refreshTokenRepo: RefreshTokenRepository;
  emailVerificationRepo: EmailVerificationRepository;
} {
  const usersService = {
    findByEmail: vi.fn(),
    findByIdOrThrow: vi.fn(),
    existsByEmail: vi.fn(),
    countAll: vi.fn(),
    create: vi.fn(),
    updateLastLogin: vi.fn(),
    setEmailVerified: vi.fn(),
    toAuthUser: vi.fn().mockReturnValue({ id: 'user-1', email: 'test@example.com' }),
  } as unknown as UsersService;

  const householdsService = {
    createDefault: vi.fn().mockResolvedValue({ id: 'household-1', name: 'Mein Haushalt' }),
  } as unknown as HouseholdsService;

  const mailService = {
    sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  } as unknown as MailService;

  const auditService = {
    log: vi.fn(),
  } as unknown as AuditService;

  const jwtService = {
    sign: vi.fn().mockReturnValue('signed-jwt'),
  } as unknown as JwtService;

  const configService = {
    get: vi.fn().mockReturnValue(undefined),
  } as unknown as ConfigService;

  const refreshTokenRepo = {
    create: vi.fn().mockResolvedValue(undefined),
    findByTokenHash: vi.fn(),
    revoke: vi.fn().mockResolvedValue(undefined),
    revokeAllForUser: vi.fn().mockResolvedValue(undefined),
    deleteExpired: vi.fn().mockResolvedValue(undefined),
  } as unknown as RefreshTokenRepository;

  const emailVerificationRepo = {
    create: vi.fn().mockResolvedValue(undefined),
    findByToken: vi.fn(),
    deleteByUserId: vi.fn().mockResolvedValue(undefined),
    deleteByToken: vi.fn().mockResolvedValue(undefined),
    deleteExpired: vi.fn().mockResolvedValue(undefined),
  } as unknown as EmailVerificationRepository;

  const categoriesService = {
    seedDefaults: vi.fn().mockResolvedValue(undefined),
  } as unknown as import('../categories/categories.service').CategoriesService;

  const service = new AuthService(
    usersService,
    householdsService,
    categoriesService,
    mailService,
    auditService,
    jwtService,
    configService,
    refreshTokenRepo,
    emailVerificationRepo,
  );

  return {
    service,
    usersService,
    householdsService,
    mailService,
    auditService,
    jwtService,
    configService,
    refreshTokenRepo,
    emailVerificationRepo,
  };
}

describe('AuthService', () => {
  beforeEach(() => {
    vi.mocked(argon2.hash).mockResolvedValue('mocked-hash');
    vi.mocked(argon2.verify).mockResolvedValue(true);
  });

  describe('validateLocalUser', () => {
    it('throws UnauthorizedException when user not found', async () => {
      const { service, usersService } = buildService();
      vi.mocked(usersService.findByEmail).mockResolvedValue(null);

      await expect(service.validateLocalUser('unknown@example.com', 'any')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException when user is deleted', async () => {
      const { service, usersService } = buildService();
      vi.mocked(usersService.findByEmail).mockResolvedValue(makeUser({ isDeleted: true }));

      await expect(service.validateLocalUser('test@example.com', 'any')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException when user has no password hash', async () => {
      const { service, usersService } = buildService();
      vi.mocked(usersService.findByEmail).mockResolvedValue(makeUser({ passwordHash: null }));

      await expect(service.validateLocalUser('test@example.com', 'any')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException when password does not match', async () => {
      const { service, usersService } = buildService();
      vi.mocked(usersService.findByEmail).mockResolvedValue(makeUser());
      vi.mocked(argon2.verify).mockResolvedValue(false);

      await expect(service.validateLocalUser('test@example.com', 'wrong')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('returns user when credentials are valid', async () => {
      const { service, usersService } = buildService();
      const user = makeUser();
      vi.mocked(usersService.findByEmail).mockResolvedValue(user);
      vi.mocked(argon2.verify).mockResolvedValue(true);

      const result = await service.validateLocalUser('test@example.com', 'correct-password');
      expect(result).toBe(user);
    });
  });

  describe('register', () => {
    it('throws ForbiddenException when registration is disabled', async () => {
      const { service, configService } = buildService();
      vi.mocked(configService.get).mockReturnValue(false);

      await expect(
        service.register({ email: 'new@example.com', displayName: 'User', password: 'pass' }, fakeReq),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ConflictException when email is already taken', async () => {
      const { service, usersService } = buildService();
      vi.mocked(usersService.existsByEmail).mockResolvedValue(true);

      await expect(
        service.register({ email: 'taken@example.com', displayName: 'User', password: 'pass' }, fakeReq),
      ).rejects.toThrow(ConflictException);
    });

    it('creates household and sends verification email on success', async () => {
      const { service, usersService, householdsService, mailService, emailVerificationRepo } = buildService();

      vi.mocked(usersService.existsByEmail).mockResolvedValue(false);
      vi.mocked(usersService.countAll).mockResolvedValue(1);
      vi.mocked(usersService.create).mockResolvedValue(makeUser());

      const result = await service.register(
        { email: 'new@example.com', displayName: 'New User', password: 'securePass1!' },
        fakeReq,
      );

      expect(householdsService.createDefault).toHaveBeenCalledWith('user-1');
      expect(emailVerificationRepo.create).toHaveBeenCalled();
      expect(mailService.sendVerificationEmail).toHaveBeenCalledWith(
        'new@example.com',
        'New User',
        expect.any(String),
      );
      expect(result.message).toContain('Registrierung erfolgreich');
    });
  });

  describe('login', () => {
    it('throws ForbiddenException when emailVerified is false', async () => {
      const { service } = buildService();
      const unverifiedUser = makeUser({ emailVerified: false });

      await expect(service.login(unverifiedUser, {}, fakeReq)).rejects.toThrow(ForbiddenException);
    });

    it('returns tokens when user is verified', async () => {
      const { service, usersService } = buildService();
      const user = makeUser({ emailVerified: true });
      vi.mocked(usersService.updateLastLogin).mockResolvedValue(undefined);

      const result = await service.login(user, {}, fakeReq);

      expect(result.accessToken).toBe('signed-jwt');
      expect(result.refreshToken).toBeDefined();
      expect(result.refreshExpiresIn).toBeGreaterThan(0);
    });

    it('uses longer TTL when rememberMe is true', async () => {
      const { service, usersService } = buildService();
      const user = makeUser({ emailVerified: true });
      vi.mocked(usersService.updateLastLogin).mockResolvedValue(undefined);

      const shortResult = await service.login(user, { rememberMe: false }, fakeReq);
      const longResult = await service.login(user, { rememberMe: true }, fakeReq);

      expect(longResult.refreshExpiresIn).toBeGreaterThan(shortResult.refreshExpiresIn);
    });
  });

  describe('refresh', () => {
    it('throws UnauthorizedException when token is not found', async () => {
      const { service, refreshTokenRepo } = buildService();
      vi.mocked(refreshTokenRepo.findByTokenHash).mockResolvedValue(null);

      await expect(service.refresh('invalid-token', fakeReq)).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when token is revoked', async () => {
      const { service, refreshTokenRepo } = buildService();
      vi.mocked(refreshTokenRepo.findByTokenHash).mockResolvedValue(
        makeRefreshToken({ revokedAt: new Date() }),
      );

      await expect(service.refresh('revoked-token', fakeReq)).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when token is expired', async () => {
      const { service, refreshTokenRepo } = buildService();
      vi.mocked(refreshTokenRepo.findByTokenHash).mockResolvedValue(
        makeRefreshToken({ expiresAt: new Date(Date.now() - 1000) }),
      );

      await expect(service.refresh('expired-token', fakeReq)).rejects.toThrow(UnauthorizedException);
    });

    it('rotates token and returns new access token on success', async () => {
      const { service, refreshTokenRepo, usersService } = buildService();
      vi.mocked(refreshTokenRepo.findByTokenHash).mockResolvedValue(makeRefreshToken());
      vi.mocked(usersService.findByIdOrThrow).mockResolvedValue(makeUser());

      const result = await service.refresh('valid-raw-token', fakeReq);

      expect(refreshTokenRepo.revoke).toHaveBeenCalledWith('rt-1');
      expect(refreshTokenRepo.create).toHaveBeenCalled();
      expect(result.accessToken).toBe('signed-jwt');
      expect(result.refreshToken).toBeDefined();
      expect(result.refreshToken).not.toBe('valid-raw-token');
    });
  });

  describe('logout', () => {
    it('revokes the token when found', async () => {
      const { service, refreshTokenRepo } = buildService();
      vi.mocked(refreshTokenRepo.findByTokenHash).mockResolvedValue(makeRefreshToken());

      await service.logout('raw-token', 'user-1');

      expect(refreshTokenRepo.revoke).toHaveBeenCalledWith('rt-1');
    });

    it('completes without error when token is not found', async () => {
      const { service, refreshTokenRepo } = buildService();
      vi.mocked(refreshTokenRepo.findByTokenHash).mockResolvedValue(null);

      await service.logout('unknown-token', 'user-1');

      expect(refreshTokenRepo.revoke).not.toHaveBeenCalled();
    });
  });

  describe('verifyEmail', () => {
    it('throws BadRequestException when token not found', async () => {
      const { service, emailVerificationRepo } = buildService();
      vi.mocked(emailVerificationRepo.findByToken).mockResolvedValue(null);

      await expect(service.verifyEmail('invalid-token')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when token is expired', async () => {
      const { service, emailVerificationRepo } = buildService();
      const expired = makeVerification({ expiresAt: new Date(Date.now() - 1000) });
      vi.mocked(emailVerificationRepo.findByToken).mockResolvedValue(expired);

      await expect(service.verifyEmail('expired-token')).rejects.toThrow(BadRequestException);
    });

    it('verifies email and deletes token on success', async () => {
      const { service, emailVerificationRepo, usersService } = buildService();
      const record = makeVerification();
      vi.mocked(emailVerificationRepo.findByToken).mockResolvedValue(record);
      vi.mocked(usersService.setEmailVerified).mockResolvedValue(undefined);

      await service.verifyEmail('token-abc');

      expect(usersService.setEmailVerified).toHaveBeenCalledWith('user-1');
      expect(emailVerificationRepo.deleteByToken).toHaveBeenCalledWith('token-abc');
    });
  });

  describe('resendVerification', () => {
    it('does nothing when user is not found', async () => {
      const { service, usersService, mailService } = buildService();
      vi.mocked(usersService.findByEmail).mockResolvedValue(null);

      await service.resendVerification('unknown@example.com');

      expect(mailService.sendVerificationEmail).not.toHaveBeenCalled();
    });

    it('does nothing when user is already verified', async () => {
      const { service, usersService, mailService } = buildService();
      vi.mocked(usersService.findByEmail).mockResolvedValue(makeUser({ emailVerified: true }));

      await service.resendVerification('verified@example.com');

      expect(mailService.sendVerificationEmail).not.toHaveBeenCalled();
    });

    it('sends a new verification email for unverified users', async () => {
      const { service, usersService, mailService, emailVerificationRepo } = buildService();
      vi.mocked(usersService.findByEmail).mockResolvedValue(makeUser({ emailVerified: false }));

      await service.resendVerification('unverified@example.com');

      expect(emailVerificationRepo.deleteByUserId).toHaveBeenCalledWith('user-1');
      expect(emailVerificationRepo.create).toHaveBeenCalled();
      expect(mailService.sendVerificationEmail).toHaveBeenCalledWith(
        'unverified@example.com',
        'Test User',
        expect.any(String),
      );
    });
  });
});
