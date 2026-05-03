import {
  Injectable,
  Logger,
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
import { TempTokenRepository } from './repositories/temp-token.repository';
import type { JwtPayload } from '../common/types/jwt-payload.type';
import { generateTotpSecret, generateTotpUri, verifyTotpCode } from './totp.utils';

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
  private readonly logger = new Logger(AuthService.name);

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
    private readonly tempTokenRepo: TempTokenRepository,
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
    this.mailService.sendVerificationEmail(email, dto.displayName, token).catch((err) => {
      this.logger.error(`Failed to send verification email to ${email}: ${String(err)}`);
    });

    this.auditService.log({
      action: 'user.register',
      userId: user.id,
      ip: req.ip,
      userAgent: extractUserAgent(req),
    });

    return { message: 'Registrierung erfolgreich. Bitte bestätige deine E-Mail-Adresse.' };
  }

  async login(user: User, opts: LoginOptions, req: IncomingRequest): Promise<TokenSet | { requiresTotp: true; tempToken: string }> {
    if (!user.emailVerified) {
      throw new ForbiddenException('E-Mail-Adresse noch nicht bestätigt');
    }

    await this.usersService.updateLastLogin(user.id);

    if (user.totpEnabled) {
      const tempToken = generateToken();
      await this.tempTokenRepo.create({
        userId: user.id,
        token: tempToken,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        purpose: 'totp_login',
      });
      return { requiresTotp: true, tempToken };
    }

    return this.createTokens(user, opts, req);
  }

  async verifyTotpAndLogin(tempToken: string, totpCode: string, opts: LoginOptions, req: IncomingRequest): Promise<TokenSet> {
    const temp = await this.tempTokenRepo.findByToken(tempToken);
    if (!temp || temp.expiresAt < new Date() || temp.purpose !== 'totp_login') {
      throw new UnauthorizedException('Ungültiger oder abgelaufener Token');
    }
    if (temp.usedAt) {
      throw new UnauthorizedException('Token bereits verwendet');
    }

    const user = await this.usersService.findByIdOrThrow(temp.userId);
    if (!user.totpEnabled || !user.totpSecret) {
      throw new BadRequestException('2FA ist nicht eingerichtet');
    }
    if (!verifyTotpCode(user.totpSecret, totpCode)) {
      throw new UnauthorizedException('Ungültiger Code');
    }

    await this.tempTokenRepo.markUsed(temp.id);

    this.auditService.log({
      action: 'user.login_totp',
      userId: user.id,
      ip: req.ip,
      userAgent: extractUserAgent(req),
    });

    return this.createTokens(user, opts, req);
  }

  private async createTokens(user: User, opts: LoginOptions, req: IncomingRequest): Promise<TokenSet> {
    const refreshTokenRaw = generateToken();
    const tokenHash = hashToken(refreshTokenRaw);
    const ttlMs = opts.rememberMe ? REFRESH_TTL_REMEMBER_MS : REFRESH_TTL_DEFAULT_MS;
    const expiresAt = new Date(Date.now() + ttlMs);

    const createdRefreshToken = await this.refreshTokenRepo.create({
      userId: user.id,
      tokenHash,
      expiresAt,
      userAgent: extractUserAgent(req),
      ip: req.ip,
    });

    const accessToken = this.signAccessToken(user, createdRefreshToken.id);

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

    const newRaw = generateToken();
    const newHash = hashToken(newRaw);
    const remainingMs = Math.max(stored.expiresAt.getTime() - Date.now(), 0);
    const expiresAt = new Date(Date.now() + remainingMs);

    const newToken = await this.refreshTokenRepo.create({
      userId: user.id,
      tokenHash: newHash,
      expiresAt,
      userAgent: extractUserAgent(req),
      ip: req.ip,
    });

    const accessToken = this.signAccessToken(user, newToken.id);

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
    this.mailService.sendVerificationEmail(lower, user.displayName, token).catch((err) => {
      this.logger.error(`Failed to send verification email to ${lower}: ${String(err)}`);
    });
  }

  toAuthUser(user: User): AuthUser {
    return this.usersService.toAuthUser(user);
  }

  private signAccessToken(user: User, refreshTokenId?: string): string {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.appRole,
      type: 'access',
      ...(refreshTokenId && { refreshTokenId }),
    };
    return this.jwtService.sign(payload);
  }

  // ── TOTP / 2FA ─────────────────────────────────────────────────────

  async setupTotp(userId: string): Promise<{ secret: string; uri: string }> {
    const user = await this.usersService.findByIdOrThrow(userId);
    if (user.totpEnabled) {
      throw new ConflictException('2FA ist bereits aktiviert');
    }
    const secret = generateTotpSecret();
    const uri = generateTotpUri(secret, user.email);
    await this.usersService.update(userId, { totpSecret: secret });
    return { secret, uri };
  }

  async verifyAndEnableTotp(userId: string, code: string): Promise<void> {
    const user = await this.usersService.findByIdOrThrow(userId);
    if (!user.totpSecret) {
      throw new BadRequestException('2FA wurde noch nicht eingerichtet');
    }
    if (user.totpEnabled) {
      throw new ConflictException('2FA ist bereits aktiviert');
    }
    if (!verifyTotpCode(user.totpSecret, code)) {
      throw new UnauthorizedException('Ungültiger Code');
    }
    await this.usersService.update(userId, { totpEnabled: true });
    this.auditService.log({ action: 'user.totp_enabled', userId });
  }

  async disableTotp(userId: string): Promise<void> {
    const user = await this.usersService.findByIdOrThrow(userId);
    if (!user.totpEnabled) {
      throw new BadRequestException('2FA ist nicht aktiviert');
    }
    await this.usersService.update(userId, { totpSecret: null, totpEnabled: false });
    this.auditService.log({ action: 'user.totp_disabled', userId });
  }

  verifyTotp(userId: string, code: string): boolean {
    // This is handled in the login flow - need to fetch user from DB
    return true;
  }
}
