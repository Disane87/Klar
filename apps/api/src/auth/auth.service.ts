import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as argon2 from 'argon2';
import type { User } from '@prisma/client';
import { AppRole } from '@prisma/client';
import type { AuthUser, RegisterResponse } from '@klar/shared';
import { UsersService } from '../users/users.service';
import { HouseholdsService } from '../households/households.service';
import { CategoriesService } from '../categories/categories.service';
import { MailService } from '../mail/mail.service';
import { AuditService } from '../audit/audit.service';
import { RefreshTokenRepository } from './repositories/refresh-token.repository';
import { EmailVerificationRepository } from './repositories/email-verification.repository';
import type { JwtPayload } from '../common/types/jwt-payload.type';

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
} as const;

const REFRESH_TTL_DEFAULT_MS = 7 * 24 * 60 * 60 * 1000;
const REFRESH_TTL_REMEMBER_MS = 30 * 24 * 60 * 60 * 1000;
const EMAIL_VERIFY_TTL_MS = 24 * 60 * 60 * 1000;

export interface RegisterInput {
  email: string;
  displayName: string;
  password: string;
}

export interface TokenSet {
  accessToken: string;
  user: AuthUser;
  refreshToken: string;
  refreshExpiresIn: number;
}

interface LoginOptions {
  rememberMe?: boolean;
}

interface IncomingRequest {
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
}

function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function extractUserAgent(req: IncomingRequest): string | undefined {
  const ua = req.headers['user-agent'];
  return Array.isArray(ua) ? ua[0] : ua;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly householdsService: HouseholdsService,
    private readonly categoriesService: CategoriesService,
    private readonly mailService: MailService,
    private readonly auditService: AuditService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly refreshTokenRepo: RefreshTokenRepository,
    private readonly emailVerificationRepo: EmailVerificationRepository,
  ) {}

  async validateLocalUser(email: string, password: string): Promise<User> {
    const lower = email.toLowerCase();
    const user = await this.usersService.findByEmail(lower);
    if (!user || user.isDeleted) {
      throw new UnauthorizedException('Ungültige Anmeldedaten');
    }
    if (!user.passwordHash) {
      throw new UnauthorizedException('Ungültige Anmeldedaten');
    }
    const valid = await argon2.verify(user.passwordHash, password);
    if (!valid) {
      throw new UnauthorizedException('Ungültige Anmeldedaten');
    }
    return user;
  }

  async register(dto: RegisterInput, req: IncomingRequest): Promise<RegisterResponse> {
    const registrationEnabled = this.config.get<boolean>('app.registrationEnabled') !== false;
    if (!registrationEnabled) {
      throw new ForbiddenException('Registrierung ist deaktiviert');
    }

    const email = dto.email.toLowerCase();
    const exists = await this.usersService.existsByEmail(email);
    if (exists) {
      throw new ConflictException('E-Mail-Adresse bereits vergeben');
    }

    const passwordHash = await argon2.hash(dto.password, ARGON2_OPTIONS);
    const count = await this.usersService.countAll();
    const appRole = count === 0 ? AppRole.ADMIN : AppRole.USER;

    const user = await this.usersService.create({
      email,
      displayName: dto.displayName,
      passwordHash,
      appRole,
    });

    const household = await this.householdsService.createDefault(user.id);
    await this.categoriesService.seedDefaults(household.id);

    const token = generateToken();
    const expiresAt = new Date(Date.now() + EMAIL_VERIFY_TTL_MS);
    await this.emailVerificationRepo.create({ userId: user.id, token, expiresAt });
    await this.mailService.sendVerificationEmail(email, dto.displayName, token);

    this.auditService.log({
      action: 'user.register',
      userId: user.id,
      ip: req.ip,
      userAgent: extractUserAgent(req),
    });

    return { message: 'Registrierung erfolgreich. Bitte bestätige deine E-Mail-Adresse.' };
  }

  async login(user: User, opts: LoginOptions, req: IncomingRequest): Promise<TokenSet> {
    if (!user.emailVerified) {
      throw new ForbiddenException('E-Mail-Adresse noch nicht bestätigt');
    }

    await this.usersService.updateLastLogin(user.id);

    const accessToken = this.signAccessToken(user);
    const refreshTokenRaw = generateToken();
    const tokenHash = hashToken(refreshTokenRaw);
    const ttlMs = opts.rememberMe ? REFRESH_TTL_REMEMBER_MS : REFRESH_TTL_DEFAULT_MS;
    const expiresAt = new Date(Date.now() + ttlMs);

    await this.refreshTokenRepo.create({
      userId: user.id,
      tokenHash,
      expiresAt,
      userAgent: extractUserAgent(req),
      ip: req.ip,
    });

    this.auditService.log({
      action: 'user.login',
      userId: user.id,
      ip: req.ip,
      userAgent: extractUserAgent(req),
    });

    return {
      accessToken,
      user: this.usersService.toAuthUser(user),
      refreshToken: refreshTokenRaw,
      refreshExpiresIn: Math.floor(ttlMs / 1000),
    };
  }

  async refresh(refreshTokenRaw: string, req: IncomingRequest): Promise<TokenSet> {
    const hash = hashToken(refreshTokenRaw);
    const stored = await this.refreshTokenRepo.findByTokenHash(hash);

    if (!stored || stored.revokedAt !== null || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Ungültiger oder abgelaufener Refresh-Token');
    }

    await this.refreshTokenRepo.revoke(stored.id);

    const user = await this.usersService.findByIdOrThrow(stored.userId);
    if (user.isDeleted) {
      throw new UnauthorizedException('Benutzer nicht gefunden');
    }

    const accessToken = this.signAccessToken(user);
    const newRaw = generateToken();
    const newHash = hashToken(newRaw);
    const remainingMs = Math.max(stored.expiresAt.getTime() - Date.now(), 0);
    const expiresAt = new Date(Date.now() + remainingMs);

    await this.refreshTokenRepo.create({
      userId: user.id,
      tokenHash: newHash,
      expiresAt,
      userAgent: extractUserAgent(req),
      ip: req.ip,
    });

    // fire-and-forget — AuditService.log() is void and handles its own errors
    this.auditService.log({
      action: 'user.token_refresh',
      userId: user.id,
      ip: req.ip,
      userAgent: extractUserAgent(req),
    });

    return {
      accessToken,
      user: this.usersService.toAuthUser(user),
      refreshToken: newRaw,
      refreshExpiresIn: Math.floor(remainingMs / 1000),
    };
  }

  async logout(refreshTokenRaw: string, userId: string): Promise<void> {
    const hash = hashToken(refreshTokenRaw);
    const stored = await this.refreshTokenRepo.findByTokenHash(hash);
    if (stored) {
      await this.refreshTokenRepo.revoke(stored.id);
    }
    this.auditService.log({ action: 'user.logout', userId });
  }

  async verifyEmail(token: string): Promise<void> {
    const record = await this.emailVerificationRepo.findByToken(token);
    if (!record) {
      throw new BadRequestException('Ungültiger oder abgelaufener Link');
    }
    if (record.expiresAt < new Date()) {
      await this.emailVerificationRepo.deleteByToken(token);
      throw new BadRequestException('Ungültiger oder abgelaufener Link');
    }

    await this.usersService.setEmailVerified(record.userId);
    await this.emailVerificationRepo.deleteByToken(token);

    this.auditService.log({
      action: 'user.email_verified',
      userId: record.userId,
    });
  }

  async resendVerification(email: string): Promise<void> {
    const lower = email.toLowerCase();
    const user = await this.usersService.findByEmail(lower);
    if (!user || user.isDeleted || user.emailVerified) return;

    await this.emailVerificationRepo.deleteByUserId(user.id);
    const token = generateToken();
    const expiresAt = new Date(Date.now() + EMAIL_VERIFY_TTL_MS);
    await this.emailVerificationRepo.create({ userId: user.id, token, expiresAt });
    await this.mailService.sendVerificationEmail(lower, user.displayName, token);
  }

  toAuthUser(user: User): AuthUser {
    return this.usersService.toAuthUser(user);
  }

  private signAccessToken(user: User): string {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.appRole,
      type: 'access',
    };
    return this.jwtService.sign(payload);
  }
}
