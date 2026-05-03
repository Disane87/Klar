import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import type { User } from '@prisma/client';
import { AppRole } from '@prisma/client';
import type { AuthUser, UserProfile, OidcIdentityItem, SessionItem } from '@klar/shared';
import { UsersRepository } from './users.repository';
import { OidcRepository } from '../oidc/oidc.repository';
import { RefreshTokenRepository } from '../auth/repositories/refresh-token.repository';
import { MailService } from '../mail/mail.service';
import { AuditService } from '../audit/audit.service';
import { HouseholdsRepository } from '../households/households.repository';

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
} as const;

@Injectable()
export class UsersService {
  constructor(
    private readonly repo: UsersRepository,
    private readonly oidcRepo: OidcRepository,
    private readonly refreshTokenRepo: RefreshTokenRepository,
    private readonly mailService: MailService,
    private readonly auditService: AuditService,
    private readonly householdsRepo: HouseholdsRepository,
  ) {}

  findByEmail(email: string): Promise<User | null> {
    return this.repo.findByEmail(email);
  }

  async findByIdOrThrow(id: string): Promise<User> {
    const user = await this.repo.findById(id);
    if (!user) throw new NotFoundException(`User ${id} nicht gefunden`);
    return user;
  }

  existsByEmail(email: string): Promise<boolean> {
    return this.repo.existsByEmail(email);
  }

  countAll(): Promise<number> {
    return this.repo.countAll();
  }

  create(data: { email: string; displayName: string; passwordHash: string | null; appRole: AppRole; emailVerified?: boolean }): Promise<User> {
    return this.repo.create(data);
  }

  updateLastLogin(id: string): Promise<void> {
    return this.repo.updateLastLogin(id);
  }

  setEmailVerified(id: string): Promise<void> {
    return this.repo.setEmailVerified(id);
  }

  setAppRole(id: string, appRole: AppRole): Promise<User> {
    return this.repo.setAppRole(id, appRole);
  }

  setPassword(id: string, passwordHash: string): Promise<void> {
    return this.repo.setPassword(id, passwordHash);
  }

  async getProfile(userId: string): Promise<UserProfile> {
    const user = await this.repo.findWithOidc(userId);
    if (!user) throw new NotFoundException(`User ${userId} nicht gefunden`);
    return {
      id: user.id,
      email: user.email,
      emailVerified: user.emailVerified,
      displayName: user.displayName,
      hasPassword: user.passwordHash !== null,
      appRole: user.appRole,
      createdAt: user.createdAt.toISOString(),
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      totpEnabled: user.totpEnabled,
      oidcIdentities: user.oidcIdentities.map((o): OidcIdentityItem => ({
        id: o.id,
        providerName: o.providerName,
        email: o.email,
        createdAt: o.createdAt.toISOString(),
        lastLoginAt: o.lastLoginAt?.toISOString() ?? null,
      })),
    };
  }

  async updateProfile(
    userId: string,
    dto: { displayName?: string; email?: string },
  ): Promise<UserProfile> {
    if (dto.email) {
      const lower = dto.email.toLowerCase();
      const exists = await this.repo.existsByEmail(lower);
      if (exists) throw new ConflictException('E-Mail-Adresse bereits vergeben');
      dto = { ...dto, email: lower };
    }
    await this.repo.updateProfile(userId, dto);
    if (dto.email) {
      const user = await this.findByIdOrThrow(userId);
      await this.mailService.sendVerificationEmail(dto.email, user.displayName, 'placeholder');
    }
    return this.getProfile(userId);
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    currentRefreshTokenId?: string,
  ): Promise<void> {
    const user = await this.findByIdOrThrow(userId);
    if (!user.passwordHash) {
      throw new UnauthorizedException('Kein Passwort gesetzt');
    }
    const valid = await argon2.verify(user.passwordHash, currentPassword);
    if (!valid) throw new UnauthorizedException('Aktuelles Passwort falsch');

    const newHash = await argon2.hash(newPassword, ARGON2_OPTIONS);
    await this.repo.setPassword(userId, newHash);

    if (currentRefreshTokenId) {
      await this.refreshTokenRepo.revokeAllForUserExcept(userId, currentRefreshTokenId);
    } else {
      await this.refreshTokenRepo.revokeAllForUser(userId);
    }

    this.auditService.log({ action: 'user.password_changed', userId });
  }

  async unlinkOidc(userId: string, identityId: string): Promise<void> {
    const user = await this.findByIdOrThrow(userId);
    const count = await this.oidcRepo.countIdentitiesByUser(userId);
    if (count <= 1 && !user.passwordHash) {
      throw new ConflictException('Mindestens eine Anmeldemethode muss aktiv bleiben');
    }
    await this.oidcRepo.deleteIdentityById(identityId, userId);
    this.auditService.log({ action: 'oidc.unlink', userId, metadata: { identityId } });
  }

  async listSessions(userId: string, currentRefreshTokenId?: string): Promise<SessionItem[]> {
    const tokens = await this.refreshTokenRepo.findActiveByUser(userId);
    return tokens.map((t): SessionItem => ({
      id: t.id,
      userAgent: t.userAgent,
      ip: t.ip,
      createdAt: t.createdAt.toISOString(),
      expiresAt: t.expiresAt.toISOString(),
      isCurrent: t.id === currentRefreshTokenId,
    }));
  }

  async revokeSession(userId: string, tokenId: string): Promise<void> {
    const tokens = await this.refreshTokenRepo.findActiveByUser(userId);
    const token = tokens.find(t => t.id === tokenId);
    if (!token) throw new NotFoundException('Sitzung nicht gefunden');
    await this.refreshTokenRepo.revoke(tokenId);
  }

  async revokeAllSessionsExcept(userId: string, currentRefreshTokenId?: string): Promise<void> {
    if (currentRefreshTokenId) {
      await this.refreshTokenRepo.revokeAllForUserExcept(userId, currentRefreshTokenId);
    } else {
      await this.refreshTokenRepo.revokeAllForUser(userId);
    }
  }

  async deleteAccount(userId: string): Promise<void> {
    const soleOwnerships = await this.householdsRepo.countOwnerMemberships(userId);
    if (soleOwnerships > 0) {
      throw new ConflictException(
        'Du bist der einzige Owner eines Haushalts. Übertrage zuerst die Owner-Rolle oder lösche den Haushalt.',
      );
    }
    await this.refreshTokenRepo.revokeAllForUser(userId);
    await this.repo.softDelete(userId);
    this.auditService.log({ action: 'user.delete', userId });
  }

  toAuthUser(user: User): AuthUser {
    return {
      id: user.id,
      email: user.email,
      emailVerified: user.emailVerified,
      displayName: user.displayName,
      appRole: user.appRole,
      createdAt: user.createdAt.toISOString(),
    };
  }

  async update(userId: string, data: Partial<Pick<User, 'totpSecret' | 'totpEnabled'>>): Promise<void> {
    await this.repo.update(userId, data);
  }
}
