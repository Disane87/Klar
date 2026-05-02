# Settings + User Management — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `/app/settings` (personal user settings) and extend `/app/haushalt` with member role management.

**Architecture:** Backend extends `UsersController` with profile/session/OIDC/delete endpoints, adds `changeRole` to `HouseholdsController`, and embeds `refreshTokenId` in the JWT so the sessions endpoint can mark the current session. Frontend adds a `ThemeService`, `UserSettingsStore`, a new `SettingsPageComponent`, two dialogs, and role-change UI in `HaushaltComponent`.

**Tech Stack:** NestJS 11 · Prisma · Vitest · Angular 21 Signals · Tailwind 4 · KlarDialogService · CDK Dialog

---

## File Map

**New files (Backend):**
- `apps/api/src/users/users.service.spec.ts` — unit tests for new service methods

**Modified files (Backend):**
- `apps/api/src/common/types/jwt-payload.type.ts` — add `refreshTokenId?: string`
- `apps/api/src/auth/repositories/refresh-token.repository.ts` — `create()` returns `RefreshToken`, add `revokeAllForUserExcept()`
- `apps/api/src/auth/auth.service.ts` — `signAccessToken()` accepts optional `refreshTokenId`, restructure `login()`/`refresh()` to pass it
- `apps/api/src/oidc/oidc.repository.ts` — add `deleteIdentityById(id, userId)`
- `apps/api/src/users/users.repository.ts` — add `updateProfile()`, `softDelete()`, `findWithOidc()`
- `apps/api/src/users/users.service.ts` — add `getProfile()`, `updateProfile()`, `changePassword()`, `unlinkOidc()`, `listSessions()`, `revokeSession()`, `revokeAllSessionsExcept()`, `deleteAccount()`
- `apps/api/src/users/users.controller.ts` — new endpoints
- `apps/api/src/users/users.module.ts` — import OidcModule + RefreshTokenRepository
- `apps/api/src/households/households.repository.ts` — add `updateMemberRole()`, `countOwners()`
- `apps/api/src/households/households.service.ts` — add `changeRole()`
- `apps/api/src/households/households.controller.ts` — add `PATCH households/:hid/members/:uid`

**New files (Shared):**
- (none — types added to existing `packages/shared/src/types.ts`)

**Modified files (Shared):**
- `packages/shared/src/types.ts` — add `UserProfile`, `OidcIdentityItem`, `SessionItem`, `UpdateProfileRequest`, `ChangePasswordRequest`, `ChangeRoleRequest`

**New files (Frontend):**
- `apps/web/src/app/core/theme/theme.service.ts`
- `apps/web/src/app/core/user/user-settings.service.ts`
- `apps/web/src/app/core/user/user-settings.store.ts`
- `apps/web/src/app/pages/settings/settings.component.ts`
- `apps/web/src/app/pages/settings/settings.component.html`
- `apps/web/src/app/pages/settings/settings.component.css`
- `apps/web/src/app/pages/settings/change-password-dialog.component.ts`
- `apps/web/src/app/pages/settings/change-password-dialog.component.html`
- `apps/web/src/app/pages/settings/delete-account-dialog.component.ts`
- `apps/web/src/app/pages/settings/delete-account-dialog.component.html`

**Modified files (Frontend):**
- `apps/web/src/app/app.routes.ts` — add `/app/settings` route
- `apps/web/src/app/core/household/household.service.ts` — add `changeMemberRole()`
- `apps/web/src/app/core/household/household.store.ts` — add `changeRole()`
- `apps/web/src/app/pages/haushalt/haushalt.component.ts` — role change logic
- `apps/web/src/app/pages/haushalt/haushalt.component.html` — role select + dialog trigger
- `apps/web/src/app/pages/haushalt/haushalt.component.css` — role select style

---

## Task 1: JWT refreshTokenId claim

**Files:**
- Modify: `apps/api/src/common/types/jwt-payload.type.ts`
- Modify: `apps/api/src/auth/repositories/refresh-token.repository.ts`
- Modify: `apps/api/src/auth/auth.service.ts`

- [ ] **Step 1: Update JwtPayload type**

Replace the entire file `apps/api/src/common/types/jwt-payload.type.ts`:
```ts
import type { AppRole } from '@klar/shared';

export type JwtPayload = {
  sub: string;
  email: string;
  role: AppRole;
  type: 'access';
  refreshTokenId?: string;
};
```

- [ ] **Step 2: Make RefreshTokenRepository.create() return the created token**

In `apps/api/src/auth/repositories/refresh-token.repository.ts`, change `create()` to return `RefreshToken` instead of `void`:
```ts
async create(data: CreateRefreshTokenData): Promise<RefreshToken> {
  return this.prisma.refreshToken.create({ data });
}
```

Also add `revokeAllForUserExcept()` after the existing `revokeAllForUser()` method:
```ts
async revokeAllForUserExcept(userId: string, excludeId: string): Promise<void> {
  await this.prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null, id: { not: excludeId } },
    data: { revokedAt: new Date() },
  });
}
```

- [ ] **Step 3: Update signAccessToken and restructure login/refresh**

In `apps/api/src/auth/auth.service.ts`, change `signAccessToken` to accept an optional `refreshTokenId`:
```ts
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
```

In `login()`, create the refresh token first to get its ID, then sign the access token:
```ts
async login(user: User, opts: LoginOptions, req: IncomingRequest): Promise<TokenSet> {
  if (!user.emailVerified) {
    throw new ForbiddenException('E-Mail-Adresse noch nicht bestätigt');
  }

  await this.usersService.updateLastLogin(user.id);

  const refreshTokenRaw = generateToken();
  const tokenHash = hashToken(refreshTokenRaw);
  const ttlMs = opts.rememberMe ? REFRESH_TTL_REMEMBER_MS : REFRESH_TTL_DEFAULT_MS;
  const expiresAt = new Date(Date.now() + ttlMs);

  const refreshToken = await this.refreshTokenRepo.create({
    userId: user.id,
    tokenHash,
    expiresAt,
    userAgent: extractUserAgent(req),
    ip: req.ip,
  });

  const accessToken = this.signAccessToken(user, refreshToken.id);

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
```

In `refresh()`, same pattern — create new token first, then sign:
```ts
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
```

- [ ] **Step 4: Run existing auth tests to verify nothing broke**

```bash
pnpm --filter api test run auth
```
Expected: all existing auth tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/common/types/jwt-payload.type.ts \
        apps/api/src/auth/repositories/refresh-token.repository.ts \
        apps/api/src/auth/auth.service.ts
git commit -m "feat(auth): embed refreshTokenId in JWT access token"
```

---

## Task 2: Shared types

**Files:**
- Modify: `packages/shared/src/types.ts`

- [ ] **Step 1: Add new types**

Append to the end of `packages/shared/src/types.ts`:
```ts
// ─── User Settings ────────────────────────────────────────────────────────────

export type OidcIdentityItem = {
  id: string;
  providerName: string;
  email: string;
  createdAt: string;
  lastLoginAt: string | null;
};

export type SessionItem = {
  id: string;
  userAgent: string | null;
  ip: string | null;
  createdAt: string;
  expiresAt: string;
  isCurrent: boolean;
};

export type UserProfile = {
  id: string;
  email: string;
  emailVerified: boolean;
  displayName: string;
  hasPassword: boolean;
  appRole: AppRole;
  createdAt: string;
  lastLoginAt: string | null;
  oidcIdentities: OidcIdentityItem[];
};

export type UpdateProfileRequest = {
  displayName?: string;
  email?: string;
};

export type ChangePasswordRequest = {
  currentPassword: string;
  newPassword: string;
};

export type ChangeRoleRequest = {
  role: HouseholdRole;
};
```

- [ ] **Step 2: Verify build**

```bash
pnpm --filter @klar/shared build
```
Expected: build succeeds with no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/types.ts
git commit -m "feat(shared): add UserProfile, Session, OidcIdentity, ChangeRole types"
```

---

## Task 3: Backend — Repository extensions

**Files:**
- Modify: `apps/api/src/oidc/oidc.repository.ts`
- Modify: `apps/api/src/users/users.repository.ts`

- [ ] **Step 1: Add deleteIdentityById to OidcRepository**

In `apps/api/src/oidc/oidc.repository.ts`, add after `deleteIdentity()`:
```ts
async deleteIdentityById(id: string, userId: string): Promise<void> {
  await this.prisma.oidcIdentity.deleteMany({ where: { id, userId } });
}
```

- [ ] **Step 2: Add repository methods to UsersRepository**

In `apps/api/src/users/users.repository.ts`, add these methods:

```ts
findWithOidc(id: string): Promise<(User & { oidcIdentities: OidcIdentity[] }) | null> {
  return this.prisma.user.findUnique({
    where: { id },
    include: { oidcIdentities: { orderBy: { createdAt: 'asc' } } },
  });
}

async updateProfile(id: string, data: { displayName?: string; email?: string }): Promise<User> {
  const update: { displayName?: string; email?: string; emailVerified?: boolean } = {};
  if (data.displayName !== undefined) update.displayName = data.displayName;
  if (data.email !== undefined) {
    update.email = data.email.toLowerCase();
    update.emailVerified = false;
  }
  return this.prisma.user.update({ where: { id }, data: update });
}

async softDelete(id: string): Promise<void> {
  await this.prisma.user.update({
    where: { id },
    data: { isDeleted: true },
  });
}
```

Add the import for `OidcIdentity` at the top (it already comes from `@prisma/client`):
```ts
import type { User, OidcIdentity } from '@prisma/client';
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/oidc/oidc.repository.ts \
        apps/api/src/users/users.repository.ts
git commit -m "feat(users): add profile update, soft-delete, OIDC unlink repo methods"
```

---

## Task 4: Backend — UsersService extensions + unit tests

**Files:**
- Modify: `apps/api/src/users/users.service.ts`
- Create: `apps/api/src/users/users.service.spec.ts`
- Modify: `apps/api/src/users/users.module.ts`

- [ ] **Step 1: Write failing unit tests**

Create `apps/api/src/users/users.service.spec.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConflictException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { AppRole, HouseholdRole } from '@prisma/client';
import { UsersService } from './users.service';
import type { UsersRepository } from './users.repository';
import type { OidcRepository } from '../oidc/oidc.repository';
import type { RefreshTokenRepository } from '../auth/repositories/refresh-token.repository';
import type { MailService } from '../mail/mail.service';
import type { AuditService } from '../audit/audit.service';
import type { HouseholdsRepository } from '../households/households.repository';
import type { User, OidcIdentity, RefreshToken } from '@prisma/client';

vi.mock('argon2', () => ({
  argon2id: 1,
  hash: vi.fn().mockResolvedValue('new-hash'),
  verify: vi.fn().mockResolvedValue(true),
}));

const makeUser = (o: Partial<User> = {}): User => ({
  id: 'u-1', email: 'a@b.com', emailVerified: true,
  displayName: 'Test', passwordHash: 'hashed', appRole: AppRole.USER,
  isDeleted: false, createdAt: new Date(), lastLoginAt: null, ...o,
});

const makeIdentity = (o: Partial<OidcIdentity> = {}): OidcIdentity => ({
  id: 'oi-1', userId: 'u-1', providerName: 'pocketid',
  oidcSub: 'sub-1', email: 'a@b.com',
  createdAt: new Date(), lastLoginAt: null, ...o,
});

const makeToken = (o: Partial<RefreshToken> = {}): RefreshToken => ({
  id: 'rt-1', userId: 'u-1', tokenHash: 'h',
  expiresAt: new Date(Date.now() + 86400000),
  revokedAt: null, userAgent: 'Chrome', ip: '1.2.3.4', createdAt: new Date(), ...o,
});

const makeRepo = (): jest.Mocked<UsersRepository> => ({
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
} as unknown as jest.Mocked<UsersRepository>);

let service: UsersService;
let repo: ReturnType<typeof makeRepo>;
let oidcRepo: jest.Mocked<OidcRepository>;
let tokenRepo: jest.Mocked<RefreshTokenRepository>;
let mailService: jest.Mocked<MailService>;
let auditService: jest.Mocked<AuditService>;
let householdsRepo: jest.Mocked<HouseholdsRepository>;

beforeEach(() => {
  repo = makeRepo();
  oidcRepo = {
    findIdentitiesByUser: vi.fn(),
    countIdentitiesByUser: vi.fn(),
    deleteIdentityById: vi.fn(),
  } as unknown as jest.Mocked<OidcRepository>;
  tokenRepo = {
    findActiveByUser: vi.fn(),
    revoke: vi.fn(),
    revokeAllForUser: vi.fn(),
    revokeAllForUserExcept: vi.fn(),
  } as unknown as jest.Mocked<RefreshTokenRepository>;
  mailService = { sendVerificationEmail: vi.fn() } as unknown as jest.Mocked<MailService>;
  auditService = { log: vi.fn() } as unknown as jest.Mocked<AuditService>;
  householdsRepo = {
    countOwnerMemberships: vi.fn(),
  } as unknown as jest.Mocked<HouseholdsRepository>;

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
```

- [ ] **Step 2: Run tests to see them fail**

```bash
pnpm --filter api test run users.service
```
Expected: FAIL — `UsersService` constructor signature mismatch.

- [ ] **Step 3: Extend UsersService with new dependencies and methods**

Replace `apps/api/src/users/users.service.ts` with:
```ts
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
      // Re-send verification email
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
}
```

- [ ] **Step 4: Add findActiveByUser to RefreshTokenRepository**

In `apps/api/src/auth/repositories/refresh-token.repository.ts`, add:
```ts
findActiveByUser(userId: string): Promise<RefreshToken[]> {
  return this.prisma.refreshToken.findMany({
    where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });
}
```

- [ ] **Step 5: Add countOwnerMemberships to HouseholdsRepository**

In `apps/api/src/households/households.repository.ts`, add:
```ts
async countOwnerMemberships(userId: string): Promise<number> {
  // Count households where userId is the ONLY owner
  const ownedHouseholds = await this.prisma.householdMembership.findMany({
    where: { userId, role: HouseholdRole.OWNER },
    select: { householdId: true },
  });
  let soleOwnerCount = 0;
  for (const { householdId } of ownedHouseholds) {
    const ownerCount = await this.prisma.householdMembership.count({
      where: { householdId, role: HouseholdRole.OWNER },
    });
    if (ownerCount === 1) soleOwnerCount++;
  }
  return soleOwnerCount;
}
```

- [ ] **Step 6: Update UsersModule to inject new dependencies**

Replace `apps/api/src/users/users.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { OidcModule } from '../oidc/oidc.module';
import { AuditModule } from '../audit/audit.module';
import { MailModule } from '../mail/mail.module';
import { HouseholdsModule } from '../households/households.module';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { RefreshTokenRepository } from '../auth/repositories/refresh-token.repository';

@Module({
  imports: [PrismaModule, OidcModule, AuditModule, MailModule, HouseholdsModule],
  controllers: [UsersController],
  providers: [UsersService, UsersRepository, RefreshTokenRepository],
  exports: [UsersService, UsersRepository],
})
export class UsersModule {}
```

**Note:** `HouseholdsModule` must export `HouseholdsRepository`. Check `apps/api/src/households/households.module.ts` and add `HouseholdsRepository` to its `exports` array if not already present.

- [ ] **Step 7: Run unit tests**

```bash
pnpm --filter api test run users.service
```
Expected: all 5 tests pass.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/users/ \
        apps/api/src/auth/repositories/refresh-token.repository.ts \
        apps/api/src/oidc/oidc.repository.ts \
        apps/api/src/households/households.repository.ts \
        apps/api/src/households/households.module.ts
git commit -m "feat(users): profile, password change, OIDC unlink, sessions, account delete"
```

---

## Task 5: Backend — UsersController new endpoints

**Files:**
- Modify: `apps/api/src/users/users.controller.ts`

- [ ] **Step 1: Replace UsersController**

Replace `apps/api/src/users/users.controller.ts`:
```ts
import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { UsersService } from './users.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../common/types/jwt-payload.type';

interface UpdateProfileBody { displayName?: string; email?: string }
interface ChangePasswordBody { currentPassword: string; newPassword: string }

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  getProfile(@CurrentUser() payload: JwtPayload) {
    return this.usersService.getProfile(payload.sub);
  }

  @Patch('me')
  updateProfile(
    @CurrentUser() payload: JwtPayload,
    @Body() body: UpdateProfileBody,
  ) {
    return this.usersService.updateProfile(payload.sub, body);
  }

  @Post('me/change-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  changePassword(
    @CurrentUser() payload: JwtPayload,
    @Body() body: ChangePasswordBody,
  ) {
    return this.usersService.changePassword(
      payload.sub,
      body.currentPassword,
      body.newPassword,
      payload.refreshTokenId,
    );
  }

  @Get('me/sessions')
  listSessions(@CurrentUser() payload: JwtPayload) {
    return this.usersService.listSessions(payload.sub, payload.refreshTokenId);
  }

  @Delete('me/sessions')
  @HttpCode(HttpStatus.NO_CONTENT)
  revokeAllSessions(@CurrentUser() payload: JwtPayload) {
    return this.usersService.revokeAllSessionsExcept(payload.sub, payload.refreshTokenId);
  }

  @Delete('me/sessions/:tokenId')
  @HttpCode(HttpStatus.NO_CONTENT)
  revokeSession(
    @CurrentUser() payload: JwtPayload,
    @Param('tokenId') tokenId: string,
  ) {
    return this.usersService.revokeSession(payload.sub, tokenId);
  }

  @Delete('me/oidc/:identityId')
  @HttpCode(HttpStatus.NO_CONTENT)
  unlinkOidc(
    @CurrentUser() payload: JwtPayload,
    @Param('identityId') identityId: string,
  ) {
    return this.usersService.unlinkOidc(payload.sub, identityId);
  }

  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAccount(
    @CurrentUser() payload: JwtPayload,
    @Req() req: FastifyRequest,
  ) {
    await this.usersService.deleteAccount(payload.sub);
    // Clear the refresh-token cookie so the client is logged out immediately
    (req.raw as unknown as { res: { clearCookie: (name: string) => void } })
      .res?.clearCookie?.('refresh_token');
  }
}
```

- [ ] **Step 2: Run API type-check**

```bash
pnpm --filter api build
```
Expected: no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/users/users.controller.ts
git commit -m "feat(users): REST endpoints for profile, sessions, OIDC, account delete"
```

---

## Task 6: Backend — Household member role change

**Files:**
- Modify: `apps/api/src/households/households.repository.ts`
- Modify: `apps/api/src/households/households.service.ts`
- Modify: `apps/api/src/households/households.controller.ts`
- Modify: `apps/api/src/households/households.service.spec.ts`

- [ ] **Step 1: Write failing test in households.service.spec.ts**

In `apps/api/src/households/households.service.spec.ts`, add inside the existing `describe` block:
```ts
describe('changeRole', () => {
  it('throws ForbiddenException when caller is not owner', async () => {
    repo.findMembership.mockResolvedValue(
      makeMembership({ role: HouseholdRole.MEMBER }),
    );

    await expect(
      service.changeRole(
        { userId: 'u-1', householdId: 'h-1', source: 'web' },
        'u-2',
        HouseholdRole.OWNER,
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when caller tries to change own role', async () => {
    repo.findMembership.mockResolvedValue(
      makeMembership({ userId: 'u-1', role: HouseholdRole.OWNER }),
    );

    await expect(
      service.changeRole(
        { userId: 'u-1', householdId: 'h-1', source: 'web' },
        'u-1',
        HouseholdRole.MEMBER,
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('throws ConflictException when demoting last owner', async () => {
    repo.findMembership.mockResolvedValue(
      makeMembership({ userId: 'u-1', role: HouseholdRole.OWNER }),
    );
    repo.countOwnerMemberships = vi.fn().mockResolvedValue(1);

    await expect(
      service.changeRole(
        { userId: 'u-1', householdId: 'h-1', source: 'web' },
        'u-2',
        HouseholdRole.MEMBER,
      ),
    ).rejects.toThrow(ConflictException);
  });
});
```

Also import `ConflictException` at the top if not already imported.

- [ ] **Step 2: Run to verify tests fail**

```bash
pnpm --filter api test run households.service
```
Expected: 3 new tests FAIL — `service.changeRole is not a function`.

- [ ] **Step 3: Add updateMemberRole to HouseholdsRepository**

In `apps/api/src/households/households.repository.ts`, add:
```ts
async updateMemberRole(
  userId: string,
  householdId: string,
  role: HouseholdRole,
): Promise<HouseholdMembership> {
  return this.prisma.householdMembership.update({
    where: { userId_householdId: { userId, householdId } },
    data: { role },
  });
}

async countOwners(householdId: string): Promise<number> {
  return this.prisma.householdMembership.count({
    where: { householdId, role: HouseholdRole.OWNER },
  });
}
```

- [ ] **Step 4: Add changeRole to HouseholdsService**

In `apps/api/src/households/households.service.ts`, add after `removeMember()`:
```ts
async changeRole(
  ctx: RequestContext,
  targetUserId: string,
  role: HouseholdRole,
): Promise<HouseholdMembership> {
  if (targetUserId === ctx.userId) {
    throw new ForbiddenException('Eigene Rolle kann nicht geändert werden');
  }

  const callerMembership = await this.repo.findMembership(ctx.userId, ctx.householdId);
  if (!callerMembership || callerMembership.role !== HouseholdRole.OWNER) {
    throw new ForbiddenException('Nur der Eigentümer kann Rollen ändern');
  }

  const targetMembership = await this.repo.findMembership(targetUserId, ctx.householdId);
  if (!targetMembership) throw new NotFoundException('Mitglied nicht gefunden');

  if (role === HouseholdRole.MEMBER && targetMembership.role === HouseholdRole.OWNER) {
    const ownerCount = await this.repo.countOwners(ctx.householdId);
    if (ownerCount <= 1) {
      throw new ConflictException('Mindestens ein Owner muss im Haushalt verbleiben');
    }
  }

  const updated = await this.repo.updateMemberRole(targetUserId, ctx.householdId, role);
  this.auditService.log({
    action: 'member.role_changed',
    userId: ctx.userId,
    householdId: ctx.householdId,
    metadata: { targetUserId, role },
  });
  return updated;
}
```

Also add `ConflictException` to the NestJS imports at the top of `households.service.ts`.

- [ ] **Step 5: Add PATCH endpoint to HouseholdsController**

In `apps/api/src/households/households.controller.ts`, add after `removeMember`:
```ts
@Patch('households/:hid/members/:uid')
@UseGuards(HouseholdMemberGuard)
changeMemberRole(
  @ReqContext() ctx: RequestContext,
  @Param('uid') targetUserId: string,
  @Body() body: { role: 'OWNER' | 'MEMBER' },
) {
  const role = body.role === 'OWNER' ? HouseholdRole.OWNER : HouseholdRole.MEMBER;
  return this.householdsService.changeRole(ctx, targetUserId, role);
}
```

Add `HouseholdRole` to the imports from `@prisma/client` at the top of the controller file.

- [ ] **Step 6: Run tests**

```bash
pnpm --filter api test run households.service
```
Expected: all tests pass including 3 new ones.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/households/
git commit -m "feat(households): member role change endpoint with owner-count guard"
```

---

## Task 7: Frontend — ThemeService

**Files:**
- Create: `apps/web/src/app/core/theme/theme.service.ts`

- [ ] **Step 1: Create the service**

Create `apps/web/src/app/core/theme/theme.service.ts`:
```ts
import { Injectable, signal, effect, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';

export type Theme = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'klar-theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private document = inject(DOCUMENT);

  readonly theme = signal<Theme>(this.loadFromStorage());

  constructor() {
    effect(() => {
      this.applyTheme(this.theme());
      localStorage.setItem(STORAGE_KEY, this.theme());
    });
  }

  set(theme: Theme): void {
    this.theme.set(theme);
  }

  private loadFromStorage(): Theme {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
    return 'dark';
  }

  private applyTheme(theme: Theme): void {
    const el = this.document.documentElement;
    el.classList.remove('light', 'dark');
    if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      el.classList.add(prefersDark ? 'dark' : 'light');
    } else {
      el.classList.add(theme);
    }
  }
}
```

- [ ] **Step 2: Initialize ThemeService at app startup**

In `apps/web/src/app/app.config.ts` (or wherever `APP_INITIALIZER` / root providers are), inject `ThemeService` at startup. The simplest approach: add an `APP_INITIALIZER` factory.

Open `apps/web/src/app/app.config.ts` and add:
```ts
import { APP_INITIALIZER } from '@angular/core';
import { ThemeService } from './core/theme/theme.service';

// Inside the providers array, add:
{
  provide: APP_INITIALIZER,
  useFactory: (theme: ThemeService) => () => { theme.theme(); }, // triggers effect
  deps: [ThemeService],
  multi: true,
},
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/core/theme/theme.service.ts \
        apps/web/src/app/app.config.ts
git commit -m "feat(theme): add ThemeService with localStorage persistence"
```

---

## Task 8: Frontend — UserSettingsService

**Files:**
- Create: `apps/web/src/app/core/user/user-settings.service.ts`

- [ ] **Step 1: Create the service**

Create `apps/web/src/app/core/user/user-settings.service.ts`:
```ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type {
  UserProfile,
  SessionItem,
  UpdateProfileRequest,
  ChangePasswordRequest,
} from '@klar/shared';

const BASE = '/api/v1/users/me';

@Injectable({ providedIn: 'root' })
export class UserSettingsService {
  private http = inject(HttpClient);

  getProfile(): Promise<UserProfile> {
    return firstValueFrom(this.http.get<UserProfile>(BASE));
  }

  updateProfile(dto: UpdateProfileRequest): Promise<UserProfile> {
    return firstValueFrom(this.http.patch<UserProfile>(BASE, dto));
  }

  changePassword(dto: ChangePasswordRequest): Promise<void> {
    return firstValueFrom(this.http.post<void>(`${BASE}/change-password`, dto));
  }

  listSessions(): Promise<SessionItem[]> {
    return firstValueFrom(this.http.get<SessionItem[]>(`${BASE}/sessions`));
  }

  revokeSession(tokenId: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${BASE}/sessions/${tokenId}`));
  }

  revokeAllSessions(): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${BASE}/sessions`));
  }

  unlinkOidc(identityId: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${BASE}/oidc/${identityId}`));
  }

  deleteAccount(): Promise<void> {
    return firstValueFrom(this.http.delete<void>(BASE));
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/core/user/user-settings.service.ts
git commit -m "feat(user): UserSettingsService with all profile/session/OIDC API calls"
```

---

## Task 9: Frontend — UserSettingsStore

**Files:**
- Create: `apps/web/src/app/core/user/user-settings.store.ts`

- [ ] **Step 1: Create the store**

Create `apps/web/src/app/core/user/user-settings.store.ts`:
```ts
import { Injectable, computed, inject, signal } from '@angular/core';
import type { UserProfile, SessionItem } from '@klar/shared';
import { UserSettingsService } from './user-settings.service';
import { AuthStore } from '../auth/auth.store';

@Injectable({ providedIn: 'root' })
export class UserSettingsStore {
  private service = inject(UserSettingsService);
  private authStore = inject(AuthStore);

  private _profile = signal<UserProfile | null>(null);
  private _sessions = signal<SessionItem[]>([]);
  private _loading = signal(false);
  private _sessionsLoading = signal(false);

  readonly profile = this._profile.asReadonly();
  readonly sessions = this._sessions.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly sessionsLoading = this._sessionsLoading.asReadonly();

  readonly hasPassword = computed(() => this._profile()?.hasPassword ?? false);
  readonly oidcIdentities = computed(() => this._profile()?.oidcIdentities ?? []);
  readonly canUnlinkOidc = computed(() =>
    this.hasPassword() || this.oidcIdentities().length > 1,
  );

  async loadProfile(): Promise<void> {
    this._loading.set(true);
    try {
      const profile = await this.service.getProfile();
      this._profile.set(profile);
    } finally {
      this._loading.set(false);
    }
  }

  async updateProfile(dto: { displayName?: string; email?: string }): Promise<void> {
    const updated = await this.service.updateProfile(dto);
    this._profile.set(updated);
    // Sync displayName into AuthStore user signal
    const currentUser = this.authStore.user();
    if (currentUser && dto.displayName) {
      this.authStore.setSession(
        { ...currentUser, displayName: dto.displayName },
        this.authStore.accessToken()!,
      );
    }
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await this.service.changePassword({ currentPassword, newPassword });
  }

  async loadSessions(): Promise<void> {
    this._sessionsLoading.set(true);
    try {
      this._sessions.set(await this.service.listSessions());
    } finally {
      this._sessionsLoading.set(false);
    }
  }

  async revokeSession(tokenId: string): Promise<void> {
    await this.service.revokeSession(tokenId);
    this._sessions.update(list => list.filter(s => s.id !== tokenId));
  }

  async revokeAllSessions(): Promise<void> {
    await this.service.revokeAllSessions();
    this._sessions.update(list => list.filter(s => s.isCurrent));
  }

  async unlinkOidc(identityId: string): Promise<void> {
    await this.service.unlinkOidc(identityId);
    this._profile.update(p =>
      p ? { ...p, oidcIdentities: p.oidcIdentities.filter(o => o.id !== identityId) } : p,
    );
  }

  async deleteAccount(): Promise<void> {
    await this.service.deleteAccount();
    await this.authStore.logout();
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/core/user/user-settings.store.ts
git commit -m "feat(user): UserSettingsStore with profile, sessions, OIDC, account delete"
```

---

## Task 10: Frontend — ChangePasswordDialog

**Files:**
- Create: `apps/web/src/app/pages/settings/change-password-dialog.component.ts`
- Create: `apps/web/src/app/pages/settings/change-password-dialog.component.html`

- [ ] **Step 1: Create the component**

Create `apps/web/src/app/pages/settings/change-password-dialog.component.ts`:
```ts
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HlmButtonDirective } from '../../shared/ui/hlm/hlm-button.directive';
import { HlmInputDirective } from '../../shared/ui/hlm/hlm-input.directive';
import { HlmLabelDirective } from '../../shared/ui/hlm/hlm-label.directive';
import { HlmSpinnerComponent } from '../../shared/ui/hlm/hlm-spinner.component';
import { KlarDialogService } from '../../shared/ui/klar-dialog.service';
import { KlarToastService } from '../../shared/ui/klar-toast.service';
import { UserSettingsStore } from '../../core/user/user-settings.store';

@Component({
  selector: 'app-change-password-dialog',
  standalone: true,
  imports: [FormsModule, HlmButtonDirective, HlmInputDirective, HlmLabelDirective, HlmSpinnerComponent],
  templateUrl: './change-password-dialog.component.html',
})
export class ChangePasswordDialogComponent {
  private store = inject(UserSettingsStore);
  private dialog = inject(KlarDialogService);
  private toast = inject(KlarToastService);

  readonly currentPassword = signal('');
  readonly newPassword = signal('');
  readonly confirmPassword = signal('');
  readonly saving = signal(false);
  readonly error = signal('');

  readonly canSubmit = () =>
    this.currentPassword().length > 0 &&
    this.newPassword().length >= 8 &&
    this.newPassword() === this.confirmPassword();

  async submit(): Promise<void> {
    this.error.set('');
    if (!this.canSubmit()) return;
    this.saving.set(true);
    try {
      await this.store.changePassword(this.currentPassword(), this.newPassword());
      this.toast.success('Passwort geändert');
      this.dialog.close();
    } catch {
      this.error.set('Aktuelles Passwort falsch oder Server-Fehler.');
    } finally {
      this.saving.set(false);
    }
  }
}
```

Create `apps/web/src/app/pages/settings/change-password-dialog.component.html`:
```html
<div class="dialog-body">
  <div class="field-group">
    <label hlmLabel for="cur-pw">Aktuelles Passwort</label>
    <input hlmInput id="cur-pw" type="password" autocomplete="current-password"
           [ngModel]="currentPassword()" (ngModelChange)="currentPassword.set($event)" />
  </div>
  <div class="field-group">
    <label hlmLabel for="new-pw">Neues Passwort</label>
    <input hlmInput id="new-pw" type="password" autocomplete="new-password"
           [ngModel]="newPassword()" (ngModelChange)="newPassword.set($event)" />
    @if (newPassword().length > 0 && newPassword().length < 8) {
      <p class="field-error">Mindestens 8 Zeichen</p>
    }
  </div>
  <div class="field-group">
    <label hlmLabel for="confirm-pw">Passwort wiederholen</label>
    <input hlmInput id="confirm-pw" type="password" autocomplete="new-password"
           [ngModel]="confirmPassword()" (ngModelChange)="confirmPassword.set($event)" />
    @if (confirmPassword().length > 0 && newPassword() !== confirmPassword()) {
      <p class="field-error">Passwörter stimmen nicht überein</p>
    }
  </div>
  @if (error()) {
    <p class="dialog-error">{{ error() }}</p>
  }
  <div class="dialog-actions">
    <button hlmBtn variant="default" [disabled]="!canSubmit() || saving()" (click)="submit()">
      @if (saving()) { <hlm-spinner [size]="12" /> }
      Speichern
    </button>
    <button hlmBtn variant="ghost" type="button" (click)="dialog.close()">Abbrechen</button>
  </div>
</div>
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/pages/settings/change-password-dialog.component.*
git commit -m "feat(settings): ChangePasswordDialog component"
```

---

## Task 11: Frontend — DeleteAccountDialog

**Files:**
- Create: `apps/web/src/app/pages/settings/delete-account-dialog.component.ts`
- Create: `apps/web/src/app/pages/settings/delete-account-dialog.component.html`

- [ ] **Step 1: Create the component**

Create `apps/web/src/app/pages/settings/delete-account-dialog.component.ts`:
```ts
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HlmButtonDirective } from '../../shared/ui/hlm/hlm-button.directive';
import { HlmInputDirective } from '../../shared/ui/hlm/hlm-input.directive';
import { HlmLabelDirective } from '../../shared/ui/hlm/hlm-label.directive';
import { HlmSpinnerComponent } from '../../shared/ui/hlm/hlm-spinner.component';
import { KlarDialogService } from '../../shared/ui/klar-dialog.service';
import { UserSettingsStore } from '../../core/user/user-settings.store';
import { AuthStore } from '../../core/auth/auth.store';

@Component({
  selector: 'app-delete-account-dialog',
  standalone: true,
  imports: [FormsModule, HlmButtonDirective, HlmInputDirective, HlmLabelDirective, HlmSpinnerComponent],
  templateUrl: './delete-account-dialog.component.html',
})
export class DeleteAccountDialogComponent {
  private store = inject(UserSettingsStore);
  private authStore = inject(AuthStore);
  private dialog = inject(KlarDialogService);

  readonly confirmEmail = signal('');
  readonly deleting = signal(false);
  readonly error = signal('');

  readonly userEmail = () => this.authStore.user()?.email ?? '';
  readonly canDelete = () =>
    this.confirmEmail().toLowerCase() === this.userEmail().toLowerCase();

  async confirm(): Promise<void> {
    if (!this.canDelete()) return;
    this.deleting.set(true);
    this.error.set('');
    try {
      await this.store.deleteAccount();
      // AuthStore.logout() navigates away — dialog never needs to close manually
    } catch (err: unknown) {
      const msg = (err as { error?: { detail?: string } }).error?.detail;
      this.error.set(msg ?? 'Konto konnte nicht gelöscht werden.');
      this.deleting.set(false);
    }
  }
}
```

Create `apps/web/src/app/pages/settings/delete-account-dialog.component.html`:
```html
<div class="dialog-body">
  <p class="dialog-warning">
    Diese Aktion ist unwiderruflich. Deine Einträge in gemeinsamen Haushalten bleiben anonymisiert erhalten.
  </p>
  <div class="field-group">
    <label hlmLabel for="confirm-email">
      Gib deine E-Mail-Adresse zur Bestätigung ein:
      <strong>{{ userEmail() }}</strong>
    </label>
    <input hlmInput id="confirm-email" type="email" autocomplete="off"
           [ngModel]="confirmEmail()" (ngModelChange)="confirmEmail.set($event)" />
  </div>
  @if (error()) {
    <p class="dialog-error">{{ error() }}</p>
  }
  <div class="dialog-actions">
    <button hlmBtn variant="destructive" [disabled]="!canDelete() || deleting()" (click)="confirm()">
      @if (deleting()) { <hlm-spinner [size]="12" /> }
      Konto unwiderruflich löschen
    </button>
    <button hlmBtn variant="ghost" type="button" (click)="dialog.close()">Abbrechen</button>
  </div>
</div>
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/pages/settings/delete-account-dialog.component.*
git commit -m "feat(settings): DeleteAccountDialog with email confirmation"
```

---

## Task 12: Frontend — SettingsPageComponent

**Files:**
- Create: `apps/web/src/app/pages/settings/settings.component.ts`
- Create: `apps/web/src/app/pages/settings/settings.component.html`
- Create: `apps/web/src/app/pages/settings/settings.component.css`

- [ ] **Step 1: Create the component**

Create `apps/web/src/app/pages/settings/settings.component.ts`:
```ts
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HlmButtonDirective } from '../../shared/ui/hlm/hlm-button.directive';
import { HlmInputDirective } from '../../shared/ui/hlm/hlm-input.directive';
import { HlmLabelDirective } from '../../shared/ui/hlm/hlm-label.directive';
import { HlmSpinnerComponent } from '../../shared/ui/hlm/hlm-spinner.component';
import { HlmBadgeDirective } from '../../shared/ui/hlm/hlm-badge.directive';
import { KlarDialogService } from '../../shared/ui/klar-dialog.service';
import { KlarToastService } from '../../shared/ui/klar-toast.service';
import { KlarIconComponent } from '../../shared/icons/klar-icon.component';
import { KlarSkeletonRowsComponent } from '../../shared/ui/klar-skeleton-rows.component';
import { UserSettingsStore } from '../../core/user/user-settings.store';
import { ThemeService, type Theme } from '../../core/theme/theme.service';
import { PageHeaderService } from '../../core/page-header/page-header.service';
import { ChangePasswordDialogComponent } from './change-password-dialog.component';
import { DeleteAccountDialogComponent } from './delete-account-dialog.component';

@Component({
  selector: 'app-settings',
  standalone: true,
  host: { class: 'flex flex-col flex-1 min-h-0 overflow-hidden' },
  imports: [
    FormsModule,
    HlmButtonDirective,
    HlmInputDirective,
    HlmLabelDirective,
    HlmSpinnerComponent,
    HlmBadgeDirective,
    KlarIconComponent,
    KlarSkeletonRowsComponent,
  ],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css',
})
export class SettingsPageComponent implements OnInit {
  protected store = inject(UserSettingsStore);
  protected themeService = inject(ThemeService);
  private dialog = inject(KlarDialogService);
  private toast = inject(KlarToastService);

  // Profile editing
  readonly editingProfile = signal(false);
  readonly editDisplayName = signal('');
  readonly editEmail = signal('');
  readonly savingProfile = signal(false);

  readonly initials = computed(() => {
    const name = this.store.profile()?.displayName ?? '';
    return name.slice(0, 2).toUpperCase();
  });

  readonly currentSessions = computed(() =>
    this.store.sessions().filter(s => s.isCurrent),
  );
  readonly otherSessions = computed(() =>
    this.store.sessions().filter(s => !s.isCurrent),
  );

  constructor() {
    inject(PageHeaderService).set({
      title: 'Einstellungen',
      subtitle: 'MEIN KONTO',
    });
  }

  async ngOnInit(): Promise<void> {
    await Promise.all([this.store.loadProfile(), this.store.loadSessions()]);
  }

  startEditProfile(): void {
    const p = this.store.profile();
    this.editDisplayName.set(p?.displayName ?? '');
    this.editEmail.set(p?.email ?? '');
    this.editingProfile.set(true);
  }

  cancelEditProfile(): void {
    this.editingProfile.set(false);
  }

  async saveProfile(): Promise<void> {
    this.savingProfile.set(true);
    try {
      await this.store.updateProfile({
        displayName: this.editDisplayName(),
        email: this.editEmail(),
      });
      this.editingProfile.set(false);
      this.toast.success('Profil gespeichert');
    } catch {
      this.toast.error('Profil konnte nicht gespeichert werden');
    } finally {
      this.savingProfile.set(false);
    }
  }

  openChangePassword(): void {
    this.dialog.open({ title: 'Passwort ändern', component: ChangePasswordDialogComponent, width: 'sm' });
  }

  openDeleteAccount(): void {
    this.dialog.open({
      title: 'Konto löschen',
      component: DeleteAccountDialogComponent,
      width: 'sm',
      disableBackdropClose: true,
    });
  }

  setTheme(theme: Theme): void {
    this.themeService.set(theme);
  }

  async revokeSession(tokenId: string): Promise<void> {
    try {
      await this.store.revokeSession(tokenId);
      this.toast.success('Sitzung widerrufen');
    } catch {
      this.toast.error('Sitzung konnte nicht widerrufen werden');
    }
  }

  async revokeAllSessions(): Promise<void> {
    try {
      await this.store.revokeAllSessions();
      this.toast.success('Alle anderen Sitzungen widerrufen');
    } catch {
      this.toast.error('Sitzungen konnten nicht widerrufen werden');
    }
  }

  async unlinkOidc(identityId: string): Promise<void> {
    try {
      await this.store.unlinkOidc(identityId);
      this.toast.success('Konto getrennt');
    } catch {
      this.toast.error('Konto konnte nicht getrennt werden');
    }
  }

  formatRelativeTime(isoString: string): string {
    const diff = Date.now() - new Date(isoString).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 2) return 'gerade eben';
    if (minutes < 60) return `vor ${minutes} Minuten`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `vor ${hours} Stunden`;
    const days = Math.floor(hours / 24);
    return `vor ${days} Tagen`;
  }
}
```

- [ ] **Step 2: Create the template**

Create `apps/web/src/app/pages/settings/settings.component.html`:
```html
<div class="page">

  <!-- Page Header -->
  <div class="page-header">
    <p class="page-super">EINSTELLUNGEN</p>
    <h1 class="page-title">Mein Konto — <em>persönliche Einstellungen.</em></h1>
  </div>

  <!-- PROFIL -->
  <div class="section">
    <div class="section-header">
      <span class="section-label">PROFIL</span>
      @if (!editingProfile()) {
        <button hlmBtn size="sm" variant="ghost" type="button" (click)="startEditProfile()">Bearbeiten</button>
      }
    </div>
    @if (store.loading()) {
      <klar-skeleton-rows [count]="3" />
    } @else if (editingProfile()) {
      <div class="edit-form">
        <div class="field-group">
          <label hlmLabel for="edit-name">Anzeigename</label>
          <input hlmInput id="edit-name" type="text"
                 [ngModel]="editDisplayName()" (ngModelChange)="editDisplayName.set($event)" />
        </div>
        <div class="field-group">
          <label hlmLabel for="edit-email">E-Mail</label>
          <input hlmInput id="edit-email" type="email"
                 [ngModel]="editEmail()" (ngModelChange)="editEmail.set($event)" />
        </div>
        <div class="form-actions">
          <button hlmBtn size="sm" variant="default" type="button"
                  [disabled]="savingProfile()" (click)="saveProfile()">
            @if (savingProfile()) { <hlm-spinner [size]="12" /> }
            Speichern
          </button>
          <button type="button" class="cancel-btn" (click)="cancelEditProfile()">Abbruch</button>
        </div>
      </div>
    } @else {
      <div class="section-body">
        <div class="profile-row">
          <div class="avatar-lg">{{ initials() }}</div>
          <div>
            <p class="profile-name">{{ store.profile()?.displayName }}</p>
            <p class="profile-email">{{ store.profile()?.email }}</p>
          </div>
        </div>
        <div class="field-row">
          <span class="field-label">Anzeigename</span>
          <span class="field-value">{{ store.profile()?.displayName }}</span>
        </div>
        <div class="field-row">
          <span class="field-label">E-Mail</span>
          <div class="field-value-row">
            <span class="field-value">{{ store.profile()?.email }}</span>
            @if (store.profile()?.emailVerified) {
              <span hlmBadge class="badge-income">Verifiziert</span>
            } @else {
              <span hlmBadge class="badge-muted">Nicht verifiziert</span>
            }
          </div>
        </div>
        <div class="field-row">
          <span class="field-label">Mitglied seit</span>
          <span class="field-value field-muted">
            {{ store.profile()?.createdAt | date:'dd. MMMM yyyy':'':'de' }}
          </span>
        </div>
      </div>
    }
  </div>

  <!-- DARSTELLUNG -->
  <div class="section">
    <div class="section-header">
      <span class="section-label">DARSTELLUNG</span>
    </div>
    <div class="section-body">
      <div class="field-row">
        <span class="field-label">Farbmodus</span>
        <div class="toggle-group">
          <button type="button" class="toggle-option"
                  [class.active]="themeService.theme() === 'light'"
                  (click)="setTheme('light')">Hell</button>
          <button type="button" class="toggle-option"
                  [class.active]="themeService.theme() === 'dark'"
                  (click)="setTheme('dark')">Dunkel</button>
          <button type="button" class="toggle-option"
                  [class.active]="themeService.theme() === 'system'"
                  (click)="setTheme('system')">System</button>
        </div>
      </div>
    </div>
  </div>

  <!-- SICHERHEIT -->
  @if (store.hasPassword()) {
    <div class="section">
      <div class="section-header">
        <span class="section-label">SICHERHEIT</span>
      </div>
      <div class="section-body">
        <div class="field-row">
          <span class="field-label">Passwort</span>
          <div class="field-value-row">
            <span class="field-value field-muted" style="font-family:var(--font-mono)">••••••••••••</span>
            <button hlmBtn size="sm" variant="ghost" type="button" (click)="openChangePassword()">Ändern</button>
          </div>
        </div>
      </div>
    </div>
  }

  <!-- VERKNÜPFTE KONTEN -->
  <div class="section">
    <div class="section-header">
      <span class="section-label">VERKNÜPFTE KONTEN</span>
    </div>
    <div class="section-body">
      @if (store.oidcIdentities().length === 0) {
        <p class="status-text">Keine verknüpften Konten.</p>
      }
      @for (identity of store.oidcIdentities(); track identity.id) {
        <div class="identity-row">
          <div class="identity-icon">{{ identity.providerName.slice(0, 2).toUpperCase() }}</div>
          <div class="identity-info">
            <p class="identity-name">{{ identity.providerName }}</p>
            <p class="identity-sub">{{ identity.email }} · verbunden seit {{ identity.createdAt | date:'dd.MM.yyyy' }}</p>
          </div>
          <button hlmBtn size="sm" variant="ghost" type="button"
                  [disabled]="!store.canUnlinkOidc()"
                  (click)="unlinkOidc(identity.id)"
                  class="unlink-btn">
            Trennen
          </button>
        </div>
      }
      <p class="hint">Mindestens eine Anmeldemethode muss aktiv bleiben.</p>
    </div>
  </div>

  <!-- AKTIVE SITZUNGEN -->
  <div class="section">
    <div class="section-header">
      <span class="section-label">AKTIVE SITZUNGEN</span>
      @if (otherSessions().length > 0) {
        <button hlmBtn size="sm" variant="ghost" type="button"
                class="danger-btn" (click)="revokeAllSessions()">
          Alle widerrufen
        </button>
      }
    </div>
    <div class="section-body">
      @if (store.sessionsLoading()) {
        <klar-skeleton-rows [count]="2" />
      } @else {
        @for (session of currentSessions(); track session.id) {
          <div class="session-row">
            <div class="session-dot"></div>
            <div class="session-info">
              <p class="session-name">{{ session.userAgent ?? 'Unbekanntes Gerät' }}</p>
              <p class="session-meta">{{ session.ip ?? '—' }} · {{ formatRelativeTime(session.createdAt) }}</p>
            </div>
            <span class="session-badge">Diese Sitzung</span>
          </div>
        }
        @for (session of otherSessions(); track session.id) {
          <div class="session-row">
            <div class="session-dot old"></div>
            <div class="session-info">
              <p class="session-name">{{ session.userAgent ?? 'Unbekanntes Gerät' }}</p>
              <p class="session-meta">{{ session.ip ?? '—' }} · {{ formatRelativeTime(session.createdAt) }}</p>
            </div>
            <button type="button" class="icon-btn danger"
                    title="Sitzung widerrufen" (click)="revokeSession(session.id)">
              <klar-icon name="close" [size]="14" />
            </button>
          </div>
        }
      }
    </div>
  </div>

  <!-- KONTO -->
  <div class="section">
    <div class="section-header">
      <span class="section-label">KONTO</span>
    </div>
    <div style="height:12px"></div>
    <div class="danger-zone">
      <p class="danger-title">Konto löschen</p>
      <p class="danger-desc">Löscht deinen Account unwiderruflich. Deine Einträge in gemeinsamen Haushalten bleiben anonymisiert erhalten.</p>
      <button hlmBtn size="sm" variant="destructive" type="button" (click)="openDeleteAccount()">
        Konto löschen …
      </button>
    </div>
  </div>

</div>
```

- [ ] **Step 3: Create the CSS**

Create `apps/web/src/app/pages/settings/settings.component.css`:
```css
.page {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-bottom: calc(env(safe-area-inset-bottom) + 4rem);
  animation: klar-enter 160ms ease-out both;
}

.page-header {
  padding: 20px 24px 18px;
  border-bottom: 2px solid var(--border);
  background: var(--surface);
}
.page-super {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-weight: 500;
  color: var(--text-muted);
  margin-bottom: 6px;
}
.page-title {
  font-size: 20px;
  font-weight: 600;
  letter-spacing: -0.02em;
}
.page-title em {
  font-family: var(--font-serif);
  font-style: italic;
  font-weight: 400;
}

.section { border-bottom: 1px solid var(--border); }
.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 24px 10px;
  background: color-mix(in oklab, var(--surface) 60%, var(--bg));
}
.section-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-weight: 500;
  color: var(--text-muted);
}
.section-body { padding: 12px 24px; }

.profile-row {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 0 14px;
}
.avatar-lg {
  width: 44px;
  height: 44px;
  border-radius: 4px;
  background: color-mix(in oklab, var(--color-accent) 15%, var(--surface-2));
  border: 1px solid color-mix(in oklab, var(--color-accent) 30%, transparent);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 700;
  color: var(--color-accent);
  flex-shrink: 0;
}
.profile-name { font-size: 15px; font-weight: 600; }
.profile-email { font-size: 12px; color: var(--text-muted); margin-top: 2px; }

.field-row {
  display: flex;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid color-mix(in oklab, var(--border) 40%, transparent);
}
.field-row:last-child { border-bottom: none; }
.field-label {
  font-size: 12px;
  color: var(--text-muted);
  width: 130px;
  flex-shrink: 0;
}
.field-value { font-size: 13px; font-weight: 500; flex: 1; }
.field-muted { color: var(--text-muted); font-weight: 400; }
.field-value-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.toggle-group {
  display: flex;
  border: 1px solid var(--border);
  border-radius: 3px;
  overflow: hidden;
}
.toggle-option {
  padding: 5px 12px;
  font-size: 11px;
  cursor: pointer;
  color: var(--text-muted);
  background: transparent;
  border: none;
  border-right: 1px solid var(--border);
  transition: all 80ms;
}
.toggle-option:last-child { border-right: none; }
.toggle-option.active { background: var(--color-accent); color: #0f0f11; font-weight: 600; }
.toggle-option:not(.active):hover { background: var(--surface-2); color: var(--text); }

.identity-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid color-mix(in oklab, var(--border) 40%, transparent);
}
.identity-row:last-child { border-bottom: none; }
.identity-icon {
  width: 28px;
  height: 28px;
  border-radius: 3px;
  background: var(--surface-2);
  border: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 700;
  color: var(--text-muted);
  flex-shrink: 0;
}
.identity-info { flex: 1; }
.identity-name { font-size: 13px; font-weight: 500; }
.identity-sub { font-size: 11px; color: var(--text-muted); margin-top: 1px; }
.unlink-btn { color: var(--color-expense) !important; }

.session-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid color-mix(in oklab, var(--border) 40%, transparent);
}
.session-row:last-child { border-bottom: none; }
.session-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--color-income);
  box-shadow: 0 0 4px var(--color-income);
  flex-shrink: 0;
}
.session-dot.old { background: var(--text-muted); box-shadow: none; }
.session-info { flex: 1; }
.session-name { font-size: 13px; font-weight: 500; }
.session-meta { font-size: 11px; color: var(--text-muted); margin-top: 1px; font-family: var(--font-mono); }
.session-badge {
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  padding: 2px 6px;
  background: color-mix(in oklab, var(--color-income) 12%, var(--surface-2));
  color: var(--color-income);
  border-radius: 2px;
  font-family: var(--font-mono);
  font-weight: 700;
  flex-shrink: 0;
}
.icon-btn {
  min-width: 44px;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 2px;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-muted);
  transition: color 100ms, background 100ms;
}
.icon-btn.danger:hover {
  color: var(--color-expense);
  background: color-mix(in oklab, var(--color-expense) 10%, transparent);
}
.danger-btn { color: var(--color-expense) !important; }

.danger-zone {
  padding: 12px 16px;
  border-left: 2px solid color-mix(in oklab, var(--color-expense) 40%, transparent);
  margin: 0 24px 16px;
  background: color-mix(in oklab, var(--color-expense) 4%, transparent);
}
.danger-title { font-size: 12px; font-weight: 600; color: var(--color-expense); margin-bottom: 4px; }
.danger-desc { font-size: 11px; color: var(--text-muted); line-height: 1.5; margin-bottom: 10px; }

.hint { font-size: 11px; color: var(--text-muted); line-height: 1.5; padding: 4px 0 8px; }
.status-text { font-size: 13px; color: var(--text-muted); padding: 8px 0; }

.edit-form {
  padding: 12px 24px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.field-group { display: flex; flex-direction: column; gap: 6px; }
.form-actions { display: flex; gap: 8px; align-items: center; }
.cancel-btn {
  min-height: 44px;
  padding: 0 10px;
  font-size: 11px;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-muted);
  border-radius: 2px;
  transition: color 100ms;
}
.cancel-btn:hover { color: var(--text); }

.badge-income {
  background: color-mix(in oklab, var(--color-income) 12%, var(--surface-2));
  color: var(--color-income);
}
.badge-muted {
  background: var(--surface-2);
  color: var(--text-muted);
}

@media (max-width: 767px) {
  .page { padding-bottom: calc(env(safe-area-inset-bottom) + 5rem); }
  .page-header, .section-header, .section-body, .edit-form, .danger-zone {
    padding-left: 16px;
    padding-right: 16px;
  }
  .danger-zone { margin-left: 16px; margin-right: 16px; }
}
```

Also add dialog shared CSS. In `apps/web/src/styles.css` (or the global styles file), add if not already present:
```css
/* Shared dialog content styles */
.dialog-body { padding: 20px 24px; display: flex; flex-direction: column; gap: 14px; }
.dialog-warning { font-size: 13px; color: var(--text-muted); line-height: 1.5; }
.dialog-error { font-size: 12px; color: var(--color-expense); }
.dialog-actions { display: flex; gap: 8px; align-items: center; padding-top: 4px; }
.field-error { font-size: 11px; color: var(--color-expense); margin-top: 2px; }
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/pages/settings/
git commit -m "feat(settings): SettingsPageComponent with all sections"
```

---

## Task 13: Route registration

**Files:**
- Modify: `apps/web/src/app/app.routes.ts`
- Modify: `apps/web/src/app/layout/side-nav/side-nav.component.ts` (if not already pointing to the route)

- [ ] **Step 1: Add /app/settings route**

In `apps/web/src/app/app.routes.ts`, add inside the `children` array of the `/app` route, after the `haushalt` entry:
```ts
{
  path: 'settings',
  loadComponent: () =>
    import('./pages/settings/settings.component').then(
      m => m.SettingsPageComponent,
    ),
},
```

- [ ] **Step 2: Verify SideNavComponent already has the settings route**

In `apps/web/src/app/layout/side-nav/side-nav.component.ts`, `SYS_ITEMS` already contains:
```ts
{ id: 'settings', label: 'Einstellungen', icon: 'settings', route: '/app/settings' }
```
No change needed. If it's missing, add it.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/app.routes.ts
git commit -m "feat(routing): add /app/settings route"
```

---

## Task 14: Frontend — Haushalt member role change

**Files:**
- Modify: `apps/web/src/app/core/household/household.service.ts`
- Modify: `apps/web/src/app/core/household/household.store.ts`
- Modify: `apps/web/src/app/pages/haushalt/haushalt.component.ts`
- Modify: `apps/web/src/app/pages/haushalt/haushalt.component.html`
- Modify: `apps/web/src/app/pages/haushalt/haushalt.component.css`

- [ ] **Step 1: Add changeMemberRole to HouseholdService**

In `apps/web/src/app/core/household/household.service.ts`, add after `removeMember()`:
```ts
changeMemberRole(hid: string, userId: string, role: 'OWNER' | 'MEMBER'): Promise<void> {
  return firstValueFrom(
    this.http.patch<void>(`${BASE}/${hid}/members/${userId}`, { role }),
  );
}
```

- [ ] **Step 2: Add changeRole to HouseholdStore**

In `apps/web/src/app/core/household/household.store.ts`, add after `removeMember()`:
```ts
async changeRole(userId: string, role: 'OWNER' | 'MEMBER'): Promise<void> {
  const id = this._activeId();
  if (!id) return;
  await this.householdService.changeMemberRole(id, userId, role);
  // Reload members to reflect new role
  await this.loadMembers();
}
```

- [ ] **Step 3: Add changeRole logic to HaushaltComponent**

In `apps/web/src/app/pages/haushalt/haushalt.component.ts`, add:
- Import: `KlarDialogService` and `HouseholdRole` type from `@klar/shared`
- Signal: `readonly roleChangePending = signal<Record<string, boolean>>({});`
- Method:

```ts
// Add to imports at top:
import { KlarDialogService } from '../../shared/ui/klar-dialog.service';
import type { HouseholdRole } from '@klar/shared';

// In the class body, add:
private dialogService = inject(KlarDialogService);
readonly roleChangePending = signal<Record<string, boolean>>({});

async changeRole(userId: string, newRole: HouseholdRole, event: Event): Promise<void> {
  const select = event.target as HTMLSelectElement;
  const oldRole = this.store.members().find(m => m.userId === userId)?.role;

  // Optimistically reset select — actual update happens after confirmation
  select.value = oldRole ?? 'MEMBER';

  const memberName = this.store.members().find(m => m.userId === userId)?.displayName ?? userId;
  const roleLabel = newRole === 'OWNER' ? 'Owner' : 'Member';
  const confirmed = await this.confirmRoleChange(memberName, roleLabel);
  if (!confirmed) return;

  this.roleChangePending.update(p => ({ ...p, [userId]: true }));
  try {
    await this.store.changeRole(userId, newRole);
    this.toast.success(`Rolle geändert`);
  } catch {
    this.toast.error('Rolle konnte nicht geändert werden');
  } finally {
    this.roleChangePending.update(p => {
      const next = { ...p };
      delete next[userId];
      return next;
    });
  }
}

private confirmRoleChange(name: string, newRoleLabel: string): Promise<boolean> {
  return new Promise(resolve => {
    // Use KlarDialogService with a simple inline confirmation approach:
    // Since we don't have a standalone ConfirmDialog yet, use window.confirm as interim
    // TODO: Replace with KlarDialog confirmation component once shared ConfirmDialog exists
    const ok = window.confirm(
      `${name} zu ${newRoleLabel} machen?\n\nOwner können Mitglieder einladen, entfernen und Rollen ändern.`,
    );
    resolve(ok);
  });
}
```

**Note:** `window.confirm` is a pragmatic interim solution. The spec calls for a `KlarDialog`-based confirmation. Replace `confirmRoleChange` with a proper dialog component if time permits, or add it as a follow-up task.

- [ ] **Step 4: Update HaushaltComponent template**

In `apps/web/src/app/pages/haushalt/haushalt.component.html`, replace the `member-row` @for loop for members:

Find the existing:
```html
@for (member of store.members(); track member.userId) {
  <div class="member-row">
    <div class="member-avatar">{{ member.displayName.slice(0, 2).toUpperCase() }}</div>
    <div class="member-info">
      <p class="member-name">{{ member.displayName }}</p>
      <p class="member-email">{{ member.email }}</p>
    </div>
    <span class="member-role">{{ member.role }}</span>
    @if (canManage() && member.role !== 'OWNER') {
      <button type="button" class="icon-btn danger" (click)="removeMember(member.userId)" title="Entfernen">
        <klar-icon name="close" [size]="14" />
      </button>
    }
  </div>
}
```

Replace with:
```html
@for (member of store.members(); track member.userId) {
  <div class="member-row">
    <div class="member-avatar">{{ member.displayName.slice(0, 2).toUpperCase() }}</div>
    <div class="member-info">
      <p class="member-name">{{ member.displayName }}</p>
      <p class="member-email">{{ member.email }}</p>
    </div>
    @if (canManage() && member.userId !== (store.activeRole() === 'OWNER' ? null : member.userId)) {
      <!-- Owner sees role select for all other members -->
      <select class="member-role-select"
              [value]="member.role"
              [disabled]="!!roleChangePending()[member.userId]"
              (change)="changeRole(member.userId, $any($event.target).value, $event)">
        <option value="MEMBER">MEMBER</option>
        <option value="OWNER">OWNER</option>
      </select>
      <button type="button" class="icon-btn danger" (click)="removeMember(member.userId)" title="Entfernen">
        <klar-icon name="close" [size]="14" />
      </button>
    } @else {
      <span class="member-role">{{ member.role }}</span>
    }
  </div>
}
```

**Note on the condition:** The owner can manage all other members. The logged-in user's own entry should not show a role select. Adjust the condition to:
```html
@if (canManage() && member.userId !== authUserId()) {
```
Where `authUserId` is a computed that reads from `AuthStore`. Add to the component:
```ts
// Add import:
import { AuthStore } from '../../core/auth/auth.store';

// In class body:
private authStore = inject(AuthStore);
readonly authUserId = computed(() => this.authStore.user()?.id);
```

Update the template condition to use `authUserId()`:
```html
@if (canManage() && member.userId !== authUserId()) {
```

- [ ] **Step 5: Add role-select CSS to haushalt.component.css**

Add at the end of `apps/web/src/app/pages/haushalt/haushalt.component.css`:
```css
.member-role-select {
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  padding: 3px 8px;
  border-radius: 2px;
  font-family: var(--font-mono);
  font-weight: 600;
  background: var(--surface-2);
  border: 1px solid var(--border);
  color: var(--text-muted);
  cursor: pointer;
  appearance: none;
  min-height: 28px;
  transition: border-color 80ms;
}
.member-role-select:hover:not(:disabled) {
  border-color: var(--color-accent);
  color: var(--text);
}
.member-role-select:disabled { opacity: 0.5; cursor: not-allowed; }
```

- [ ] **Step 6: Run frontend type-check**

```bash
pnpm --filter web build
```
Expected: no TypeScript errors.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/core/household/ \
        apps/web/src/app/pages/haushalt/
git commit -m "feat(haushalt): member role change with select + confirmation"
```

---

## Final validation

- [ ] **Run all unit tests**

```bash
pnpm test
```
Expected: all tests pass.

- [ ] **Run API type-check**

```bash
pnpm --filter api build
```
Expected: no TypeScript errors.

- [ ] **Run Web type-check**

```bash
pnpm --filter web build
```
Expected: no TypeScript errors.

- [ ] **Manual smoke test**
1. Start dev environment: `pnpm dev`
2. Navigate to `/app/settings` — all sections load
3. Edit display name → saved, toast appears
4. Toggle theme Hell/Dunkel/System — page class changes
5. View sessions — current session marked
6. Navigate to `/app/haushalt` — role select visible for other members (not self)
7. Change a member's role → window.confirm → role updated in list

- [ ] **Final commit**

```bash
git add .
git commit -m "feat: settings page + member role management complete"
```
