import {
  Injectable,
  OnModuleInit,
  ForbiddenException,
  BadRequestException,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Issuer, generators, type Client } from 'openid-client';
import * as crypto from 'crypto';
import type { User, OidcIdentity } from '@prisma/client';
import { AppRole } from '@prisma/client';
import { OidcRepository } from './oidc.repository';
import { UsersService } from '../users/users.service';
import { HouseholdsService } from '../households/households.service';
import { CategoriesService } from '../categories/categories.service';
import { AuditService } from '../audit/audit.service';

const STATE_TTL_MS = 10 * 60 * 1000;   // 10 min
const OTP_TTL_MS  =  60 * 1000;         // 60 s

interface OidcClaims {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  preferred_username?: string;
  groups?: string[];
}

@Injectable()
export class OidcService implements OnModuleInit {
  private client: Client | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly oidcRepo: OidcRepository,
    private readonly usersService: UsersService,
    private readonly householdsService: HouseholdsService,
    private readonly categoriesService: CategoriesService,
    private readonly auditService: AuditService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.isEnabled()) return;
    await this.initClient();
  }

  isEnabled(): boolean {
    return this.config.get<boolean>('oidc.enabled') === true;
  }

  getProviderName(): string {
    return this.config.get<string>('oidc.providerName') ?? 'sso';
  }

  private async initClient(): Promise<void> {
    const issuerUrl = this.config.get<string>('oidc.issuerUrl');
    const clientId  = this.config.get<string>('oidc.clientId');
    const clientSecret = this.config.get<string>('oidc.clientSecret');

    if (!issuerUrl || !clientId || !clientSecret) {
      throw new Error('OIDC_ISSUER_URL, OIDC_CLIENT_ID and OIDC_CLIENT_SECRET are required when OIDC_ENABLED=true');
    }

    const issuer = await Issuer.discover(issuerUrl);
    this.client = new issuer.Client({
      client_id: clientId,
      client_secret: clientSecret,
      response_types: ['code'],
    });
  }

  private getClient(): Client {
    if (!this.client) {
      throw new BadRequestException('OIDC ist nicht konfiguriert');
    }
    return this.client;
  }

  // ── Step 1: generate authorization URL ───────────────────────────────────

  async getAuthorizeUrl(redirectAfterLogin?: string): Promise<string> {
    if (!this.isEnabled()) throw new ForbiddenException('OIDC ist nicht aktiviert');

    const client       = this.getClient();
    const state        = generators.state();
    const codeVerifier = generators.codeVerifier();
    const codeChallenge = generators.codeChallenge(codeVerifier);
    const scopes       = this.config.get<string[]>('oidc.scopes') ?? ['openid', 'email', 'profile'];
    const redirectUri  = this.config.get<string>('oidc.redirectUri') ?? '';

    await this.oidcRepo.createLoginState({
      providerName: this.getProviderName(),
      state,
      codeVerifier,
      redirectAfterLogin,
      expiresAt: new Date(Date.now() + STATE_TTL_MS),
    });

    return client.authorizationUrl({
      scope: scopes.join(' '),
      redirect_uri: redirectUri,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });
  }

  // ── Step 2: handle callback (exchange code, JIT provision, issue OTP) ────

  async handleCallback(
    code: string,
    state: string,
    ip?: string,
    userAgent?: string,
    iss?: string,
  ): Promise<{ otpCode: string; redirectAfterLogin: string | null }> {
    if (!this.isEnabled()) throw new ForbiddenException('OIDC ist nicht aktiviert');

    // Validate state
    const storedState = await this.oidcRepo.findLoginState(state);
    if (!storedState || storedState.expiresAt < new Date()) {
      if (storedState) await this.oidcRepo.deleteLoginState(storedState.id);
      throw new BadRequestException('Ungültiger oder abgelaufener Login-State');
    }

    const redirectUri = this.config.get<string>('oidc.redirectUri') ?? '';
    const client = this.getClient();

    // Exchange code for tokens (PKCE)
    let tokenSet: Awaited<ReturnType<typeof client.callback>>;
    try {
      const callbackParams: Record<string, string> = { code, state };
      if (iss) callbackParams['iss'] = iss;

      tokenSet = await client.callback(redirectUri, callbackParams, {
        code_verifier: storedState.codeVerifier,
        state,
      });
    } catch (err) {
      await this.oidcRepo.deleteLoginState(storedState.id);
      throw new UnauthorizedException(`Token-Austausch fehlgeschlagen: ${String(err)}`);
    }

    // Delete state immediately — single use
    await this.oidcRepo.deleteLoginState(storedState.id);

    const claims = tokenSet.claims() as OidcClaims;

    // email_verified is mandatory
    if (!claims.email || !claims.email_verified) {
      throw new ForbiddenException('E-Mail-Adresse ist nicht verifiziert');
    }

    // Group mapping
    const user = await this.applyGroupMappingAndProvisionUser(claims, ip, userAgent);

    // Issue OTP
    const otpCode = crypto.randomBytes(32).toString('hex');
    await this.oidcRepo.createHandoverCode({
      code: otpCode,
      userId: user.id,
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    });

    return { otpCode, redirectAfterLogin: storedState.redirectAfterLogin ?? null };
  }

  // ── Step 3: exchange OTP for JWT tokens ──────────────────────────────────

  async exchangeHandoverCode(otpCode: string): Promise<User> {
    const stored = await this.oidcRepo.findHandoverCode(otpCode);

    if (!stored || stored.usedAt !== null || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Ungültiger oder abgelaufener Code');
    }

    await this.oidcRepo.markHandoverCodeUsed(stored.id);

    const user = await this.usersService.findByIdOrThrow(stored.userId);
    if (user.isDeleted) throw new UnauthorizedException('Benutzer nicht gefunden');

    return user;
  }

  // ── Identity management ───────────────────────────────────────────────────

  getIdentities(userId: string): Promise<OidcIdentity[]> {
    return this.oidcRepo.findIdentitiesByUser(userId);
  }

  async unlinkIdentity(userId: string, providerName: string): Promise<void> {
    const identities = await this.oidcRepo.findIdentitiesByUser(userId);
    const target = identities.find(i => i.providerName === providerName);
    if (!target) throw new NotFoundException('Verknüpfung nicht gefunden');

    const user = await this.usersService.findByIdOrThrow(userId);
    const hasPassword = !!user.passwordHash;
    const otherIdentities = identities.filter(i => i.providerName !== providerName);

    if (!hasPassword && otherIdentities.length === 0) {
      throw new ConflictException(
        'Du kannst deine letzte Anmeldemethode nicht entfernen. Bitte lege zuerst ein Passwort fest.',
      );
    }

    await this.oidcRepo.deleteIdentity(userId, providerName);
    this.auditService.log({ action: 'user.oidc_unlink', userId, metadata: { providerName } });
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private async applyGroupMappingAndProvisionUser(
    claims: OidcClaims,
    ip?: string,
    userAgent?: string,
  ): Promise<User> {
    const groups = claims.groups ?? [];
    const requiredGroup     = this.config.get<string>('oidc.requiredGroup') ?? '';
    const adminGroup        = this.config.get<string>('oidc.adminGroup') ?? '';
    const autoJoinHouseholdId = this.config.get<string>('oidc.autoJoinHouseholdId') ?? '';

    // REQUIRED group: block access if configured and user is not a member
    if (requiredGroup && !groups.includes(requiredGroup)) {
      throw new ForbiddenException('Dein Account hat keinen Zugriff auf diese Anwendung');
    }

    const email = claims.email!.toLowerCase();
    const providerName = this.getProviderName();

    // JIT provisioning: find existing identity or create user
    const existingIdentity = await this.oidcRepo.findIdentity(providerName, claims.sub);
    let user: User;

    if (existingIdentity) {
      user = await this.usersService.findByIdOrThrow(existingIdentity.userId);
      await this.oidcRepo.updateIdentityLastLogin(existingIdentity.id);
    } else {
      // Check if a local account with the same email already exists → link
      const existingUser = await this.usersService.findByEmail(email);

      if (existingUser && !existingUser.isDeleted) {
        user = existingUser;
      } else {
        // Create new user (OIDC-only, no password)
        const count = await this.usersService.countAll();
        user = await this.usersService.create({
          email,
          displayName: claims.name ?? claims.preferred_username ?? email,
          passwordHash: null,
          appRole: count === 0 ? AppRole.ADMIN : AppRole.USER,
          emailVerified: true,
        });
        const household = await this.householdsService.createDefault(user.id);
        await this.categoriesService.seedDefaults(household.id);
      }

      await this.oidcRepo.createIdentity({ userId: user.id, providerName, oidcSub: claims.sub, email });
    }

    // ADMIN group: sync appRole on every login
    if (adminGroup) {
      const shouldBeAdmin = groups.includes(adminGroup);
      const isAdmin = user.appRole === AppRole.ADMIN;
      if (shouldBeAdmin !== isAdmin) {
        user = await this.usersService.setAppRole(user.id, shouldBeAdmin ? AppRole.ADMIN : AppRole.USER);
      }
    }

    // AUTO_JOIN household: add user if not already a member
    if (autoJoinHouseholdId) {
      await this.householdsService.ensureMembership(user.id, autoJoinHouseholdId);
    }

    await this.usersService.updateLastLogin(user.id);

    this.auditService.log({
      action: existingIdentity ? 'user.oidc_login' : 'user.oidc_provision',
      userId: user.id,
      ip,
      userAgent,
      metadata: { providerName },
    });

    return user;
  }
}
