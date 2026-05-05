# Invitation Links Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the InviteCode system with one-time invitation links that can be sent via email or shared via the OS share sheet, supporting both existing and new Klar users.

**Architecture:** New `InvitationLink` Prisma model replaces `InviteCode`; single-use enforced atomically via `usedAt` flag. Backend gains a public `GET /join/:token` endpoint and authenticated `POST /join/:token`. Frontend gets an `InviteDialogComponent` opened via `KlarDialogService` and a new `/join/:token` page that handles unauthenticated users by saving the token to `sessionStorage` before redirecting to register/login.

**Tech Stack:** NestJS 11, Prisma + PostgreSQL, Angular 21 Signals, Nodemailer + Handlebars, Web Share API

**Spec:** `docs/superpowers/specs/2026-05-04-invitation-links-design.md`

---

## File Map

**Create:**
- `apps/api/src/households/invitation-link.repository.ts` — atomic token create/consume
- `apps/api/src/households/invitation-link.repository.spec.ts` — unit tests
- `apps/api/src/mail/templates/invite.hbs` — invite email HTML template
- `apps/web/src/app/pages/haushalt/invite-dialog.component.ts` — invite dialog component
- `apps/web/src/app/pages/haushalt/invite-dialog.component.html` — invite dialog template
- `apps/web/src/app/pages/join/join.component.ts` — /join/:token page
- `apps/web/src/app/pages/join/join.component.html` — join page template

**Modify:**
- `prisma/schema.prisma` — remove InviteCode, add InvitationLink
- `apps/api/src/mail/mail.service.ts` — add sendInviteEmail()
- `apps/api/src/households/households.repository.ts` — add seedDefaultTemplates()
- `apps/api/src/households/households.service.ts` — replace invite methods
- `apps/api/src/households/households.controller.ts` — new/updated endpoints
- `apps/api/src/households/households.module.ts` — swap InviteCodeRepository → InvitationLinkRepository
- `apps/api/src/app.module.ts` — add inviteToken to Pino redaction
- `packages/shared/src/types.ts` — replace InviteCode types with InvitationLink types
- `apps/web/src/app/core/household/household.service.ts` — updated HTTP calls
- `apps/web/src/app/core/household/household.store.ts` — updated store methods
- `apps/web/src/app/pages/haushalt/haushalt.component.ts` — replace old invite UI
- `apps/web/src/app/pages/register/register.component.ts` — auto-consume pending token
- `apps/web/src/app/pages/login/login.component.ts` — auto-consume pending token
- `apps/web/src/app/app.routes.ts` — add /join/:token route

**Delete:**
- `apps/api/src/households/invite-code.repository.ts`

---

## Task 1: Prisma Schema — Remove InviteCode, Add InvitationLink

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Remove InviteCode from schema.prisma**

In `prisma/schema.prisma`, delete the entire `InviteCode` model (lines 201–214) and the `inviteCodes InviteCode[]` relation in the `Household` model (line 176).

- [ ] **Step 2: Add InvitationLink model to schema.prisma**

After the `HouseholdMembership` model closing brace, add:

```prisma
model InvitationLink {
  id              String    @id @default(cuid())
  householdId     String
  token           String    @unique
  email           String?
  createdByUserId String?
  expiresAt       DateTime?
  usedAt          DateTime?
  usedByUserId    String?
  createdAt       DateTime  @default(now())

  household Household @relation(fields: [householdId], references: [id], onDelete: Cascade)

  @@index([householdId])
  @@index([token])
}
```

- [ ] **Step 3: Add invitationLinks relation to Household model**

In the `Household` model, replace `inviteCodes InviteCode[]` with:

```prisma
invitationLinks InvitationLink[]
```

- [ ] **Step 4: Generate migration**

```bash
pnpm --filter api exec prisma migrate dev --name invitation_links
```

Expected: a new migration file created at `prisma/migrations/<timestamp>_invitation_links/migration.sql`

- [ ] **Step 5: Edit migration SQL — add RLS policy and default template seed**

Open the generated migration file and append after the last `CREATE INDEX` statement:

```sql
-- Enable RLS on InvitationLink
ALTER TABLE "InvitationLink" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invitation_link_rls" ON "InvitationLink"
  USING (
    "householdId" = current_setting('app.household_id', true)
    OR current_setting('app.household_id', true) = ''
    OR current_setting('app.household_id', true) IS NULL
  );

-- Seed default INVITE template for all existing households
INSERT INTO "HouseholdMailTemplate" ("id", "householdId", "templateType", "name", "subject", "body", "isActive", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  h.id,
  'INVITE'::"MailTemplateType",
  'Einladung zum Haushalt',
  '{{inviterName}} lädt dich zu {{householdName}} ein — Klar',
  '<p>Hallo,</p><p>{{inviterName}} hat dich eingeladen, dem Haushalt <strong>{{householdName}}</strong> in Klar beizutreten.</p><p><a href="{{inviteUrl}}">Einladung annehmen</a></p><p>Der Link ist bis {{expiresAt}} gültig und kann nur einmal verwendet werden.</p>',
  true,
  now(),
  now()
FROM "Household" h
WHERE NOT EXISTS (
  SELECT 1 FROM "HouseholdMailTemplate" t
  WHERE t."householdId" = h.id AND t."templateType" = 'INVITE'::"MailTemplateType"
);
```

- [ ] **Step 6: Apply migration and verify**

```bash
pnpm --filter api exec prisma migrate deploy
```

Expected: migration applied, no errors. Then verify in Prisma Studio:

```bash
pnpm --filter api exec prisma studio
```

Check that `InvitationLink` table exists and `InviteCode` table is gone.

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add InvitationLink model, remove InviteCode"
```

---

## Task 2: InvitationLinkRepository

**Files:**
- Create: `apps/api/src/households/invitation-link.repository.ts`
- Create: `apps/api/src/households/invitation-link.repository.spec.ts`
- Delete: `apps/api/src/households/invite-code.repository.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/api/src/households/invitation-link.repository.spec.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InvitationLinkRepository } from './invitation-link.repository';

const mockPrisma = {
  invitationLink: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    delete: vi.fn(),
  },
  householdMembership: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  $transaction: vi.fn((fn: (tx: typeof mockPrisma) => unknown) => fn(mockPrisma)),
};

const repo = new InvitationLinkRepository(mockPrisma as never);

beforeEach(() => vi.clearAllMocks());

describe('InvitationLinkRepository', () => {
  it('create: generates a 32-byte base64url token', async () => {
    mockPrisma.invitationLink.create.mockResolvedValue({ id: '1', token: 'abc' });
    const result = await repo.create({ householdId: 'hid', createdByUserId: 'uid' });
    const [call] = mockPrisma.invitationLink.create.mock.calls;
    expect((call[0] as { data: { token: string } }).data.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(result).toBeDefined();
  });

  it('consumeAndJoin: throws INVITE_NOT_FOUND if token unknown', async () => {
    mockPrisma.invitationLink.findUnique.mockResolvedValue(null);
    await expect(repo.consumeAndJoin('bad', 'uid')).rejects.toThrow('INVITE_NOT_FOUND');
  });

  it('consumeAndJoin: throws INVITE_EXPIRED if expiresAt in past', async () => {
    mockPrisma.invitationLink.findUnique.mockResolvedValue({
      id: '1', token: 'tok', householdId: 'hid',
      expiresAt: new Date(Date.now() - 1000), usedAt: null,
    });
    await expect(repo.consumeAndJoin('tok', 'uid')).rejects.toThrow('INVITE_EXPIRED');
  });

  it('consumeAndJoin: throws INVITE_USED if usedAt is set', async () => {
    mockPrisma.invitationLink.findUnique.mockResolvedValue({
      id: '1', token: 'tok', householdId: 'hid',
      expiresAt: null, usedAt: new Date(),
    });
    await expect(repo.consumeAndJoin('tok', 'uid')).rejects.toThrow('INVITE_USED');
  });

  it('consumeAndJoin: throws ALREADY_MEMBER if user already in household', async () => {
    mockPrisma.invitationLink.findUnique.mockResolvedValue({
      id: '1', token: 'tok', householdId: 'hid',
      expiresAt: null, usedAt: null,
    });
    mockPrisma.householdMembership.findUnique.mockResolvedValue({ id: 'm1' });
    await expect(repo.consumeAndJoin('tok', 'uid')).rejects.toThrow('ALREADY_MEMBER');
  });

  it('consumeAndJoin: creates membership and marks link used on success', async () => {
    const invite = { id: '1', token: 'tok', householdId: 'hid', expiresAt: null, usedAt: null };
    mockPrisma.invitationLink.findUnique.mockResolvedValue(invite);
    mockPrisma.householdMembership.findUnique.mockResolvedValue(null);
    mockPrisma.householdMembership.create.mockResolvedValue({});
    mockPrisma.invitationLink.create.mockResolvedValue({});

    // patch update on the transaction object
    const updateMock = vi.fn().mockResolvedValue({});
    mockPrisma.invitationLink = { ...mockPrisma.invitationLink, update: updateMock };
    mockPrisma.$transaction.mockImplementation((fn: (tx: typeof mockPrisma) => unknown) => fn(mockPrisma));

    const result = await repo.consumeAndJoin('tok', 'uid');
    expect(mockPrisma.householdMembership.create).toHaveBeenCalled();
    expect(result).toEqual({ householdId: 'hid' });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm --filter api test invitation-link.repository.spec
```

Expected: FAIL — `InvitationLinkRepository` not found

- [ ] **Step 3: Create `invitation-link.repository.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import type { InvitationLink } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';

function generateToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

interface CreateLinkData {
  householdId: string;
  createdByUserId: string;
  email?: string;
  expiresAt?: Date;
}

@Injectable()
export class InvitationLinkRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: CreateLinkData): Promise<InvitationLink> {
    return this.prisma.invitationLink.create({
      data: {
        householdId:     data.householdId,
        token:           generateToken(),
        email:           data.email,
        createdByUserId: data.createdByUserId,
        expiresAt:       data.expiresAt,
      },
    });
  }

  findByToken(token: string): Promise<InvitationLink | null> {
    return this.prisma.invitationLink.findUnique({ where: { token } });
  }

  findActiveByHousehold(householdId: string): Promise<InvitationLink[]> {
    return this.prisma.invitationLink.findMany({
      where: {
        householdId,
        usedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async consumeAndJoin(token: string, userId: string): Promise<{ householdId: string }> {
    return this.prisma.$transaction(async (tx) => {
      const invite = await tx.invitationLink.findUnique({ where: { token } });

      if (!invite) throw new Error('INVITE_NOT_FOUND');
      if (invite.usedAt) throw new Error('INVITE_USED');
      if (invite.expiresAt && invite.expiresAt < new Date()) throw new Error('INVITE_EXPIRED');

      const existing = await tx.householdMembership.findUnique({
        where: { userId_householdId: { userId, householdId: invite.householdId } },
      });
      if (existing) throw new Error('ALREADY_MEMBER');

      await tx.householdMembership.create({
        data: { userId, householdId: invite.householdId },
      });

      await tx.invitationLink.update({
        where: { token },
        data: { usedAt: new Date(), usedByUserId: userId },
      });

      return { householdId: invite.householdId };
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.invitationLink.delete({ where: { id } });
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm --filter api test invitation-link.repository.spec
```

Expected: all 6 tests PASS

- [ ] **Step 5: Delete old repository**

```bash
rm apps/api/src/households/invite-code.repository.ts
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/households/
git commit -m "feat: add InvitationLinkRepository, remove InviteCodeRepository"
```

---

## Task 3: Email Template — invite.hbs + MailService.sendInviteEmail

**Files:**
- Create: `apps/api/src/mail/templates/invite.hbs`
- Modify: `apps/api/src/mail/mail.service.ts`

- [ ] **Step 1: Create `invite.hbs`**

Create `apps/api/src/mail/templates/invite.hbs`:

```html
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Einladung zu {{householdName}} — Klar</title>
</head>
<body style="margin:0;padding:0;background-color:#09090b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#09090b;">
    <tr>
      <td align="center" style="padding:48px 16px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;">

          <tr>
            <td align="center" style="padding-bottom:40px;">
              <span style="font-size:28px;font-weight:700;letter-spacing:-0.5px;color:#f4f4f5;">Klar</span>
            </td>
          </tr>

          <tr>
            <td style="background-color:#18181b;border-radius:12px;border:1px solid #27272a;padding:40px 40px 36px;">

              <p style="margin:0 0 8px;font-size:22px;font-weight:600;color:#f4f4f5;line-height:1.3;">
                Du wurdest eingeladen
              </p>

              <p style="margin:16px 0 0;font-size:15px;line-height:1.6;color:#a1a1aa;">
                <strong style="color:#f4f4f5;">{{inviterName}}</strong> lädt dich ein, dem Haushalt <strong style="color:#f4f4f5;">{{householdName}}</strong> in Klar beizutreten.
              </p>

              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:32px 0 24px;">
                <tr>
                  <td style="border-radius:8px;background-color:#38bdf8;">
                    <a href="{{inviteUrl}}"
                       target="_blank"
                       style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#0c1a28;text-decoration:none;border-radius:8px;letter-spacing:0.01em;">
                      Einladung annehmen
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-size:13px;color:#71717a;line-height:1.5;">
                Dieser Link ist gültig bis <strong style="color:#a1a1aa;">{{expiresAt}}</strong> und kann nur <strong style="color:#a1a1aa;">einmal</strong> verwendet werden.
              </p>

              <hr style="margin:28px 0;border:none;border-top:1px solid #27272a;" />

              <p style="margin:0;font-size:12px;color:#52525b;line-height:1.6;">
                Falls der Button nicht funktioniert, kopiere diesen Link:
              </p>
              <p style="margin:6px 0 0;font-size:12px;line-height:1.6;word-break:break-all;">
                <a href="{{inviteUrl}}" style="color:#38bdf8;text-decoration:none;">{{inviteUrl}}</a>
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding-top:28px;" align="center">
              <p style="margin:0;font-size:12px;color:#52525b;line-height:1.7;text-align:center;">
                Falls du diese Einladung nicht erwartet hast, kannst du diese E-Mail ignorieren.
              </p>
              <p style="margin:12px 0 0;font-size:11px;color:#3f3f46;">
                &copy; {{year}} Klar
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

- [ ] **Step 2: Add `sendInviteEmail` to `mail.service.ts`**

In `apps/api/src/mail/mail.service.ts`, add after `sendVerificationEmail`:

```typescript
async sendInviteEmail(
  to: string,
  context: {
    inviterName: string;
    householdName: string;
    inviteUrl: string;
    expiresAt: string;
  },
): Promise<void> {
  const year = new Date().getFullYear();
  const html = this.compile('invite', { ...context, year });
  await this.transporter.sendMail({
    from: `"${this.mail.fromName}" <${this.mail.from}>`,
    to,
    subject: `${context.inviterName} lädt dich zu ${context.householdName} ein — Klar`,
    html,
  });
  this.logger.log(`Invite email sent to ${to}`);
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/mail/
git commit -m "feat: add invite.hbs template and MailService.sendInviteEmail"
```

---

## Task 4: HouseholdsRepository — seedDefaultTemplates

**Files:**
- Modify: `apps/api/src/households/households.repository.ts`

- [ ] **Step 1: Read the current file**

```bash
cat apps/api/src/households/households.repository.ts
```

- [ ] **Step 2: Add findCallerWithUser and seedDefaultTemplates methods**

At the end of `HouseholdsRepository`, before the closing brace, add:

```typescript
findCallerWithUser(
  userId: string,
  householdId: string,
): Promise<(HouseholdMembership & { user: { displayName: string } }) | null> {
  return this.prisma.householdMembership.findUnique({
    where: { userId_householdId: { userId, householdId } },
    include: { user: { select: { displayName: true } } },
  }) as Promise<(HouseholdMembership & { user: { displayName: string } }) | null>;
}

async seedDefaultTemplates(householdId: string): Promise<void> {
  const defaults: Array<{
    templateType: import('@prisma/client').MailTemplateType;
    name: string;
    subject: string;
    body: string;
  }> = [
    {
      templateType: 'INVITE',
      name: 'Einladung zum Haushalt',
      subject: '{{inviterName}} lädt dich zu {{householdName}} ein — Klar',
      body: '<p>Hallo,</p><p>{{inviterName}} hat dich eingeladen, dem Haushalt <strong>{{householdName}}</strong> beizutreten.</p><p><a href="{{inviteUrl}}">Einladung annehmen</a></p><p>Gültig bis {{expiresAt}}. Einmalig verwendbar.</p>',
    },
  ];

  for (const tpl of defaults) {
    await this.prisma.householdMailTemplate.upsert({
      where: { householdId_templateType: { householdId, templateType: tpl.templateType } },
      create: { householdId, ...tpl, isActive: true },
      update: {},
    });
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/households/households.repository.ts
git commit -m "feat: seed default mail templates when household is created"
```

---

## Task 5: HouseholdsService — Replace InviteCode with InvitationLink

**Files:**
- Modify: `apps/api/src/households/households.service.ts`

- [ ] **Step 1: Write failing service tests**

In `apps/api/src/households/households.service.spec.ts`, add these test cases (keep existing tests, append below):

```typescript
describe('createInviteLink', () => {
  it('throws ForbiddenException if caller is not OWNER', async () => {
    mockRepo.findMembership.mockResolvedValue({ role: 'MEMBER' });
    await expect(
      service.createInviteLink({ userId: 'u1', householdId: 'h1', source: 'web' })
    ).rejects.toThrow(ForbiddenException);
  });

  it('creates invite link with default 7-day expiry', async () => {
    mockRepo.findMembership.mockResolvedValue({ role: 'OWNER' });
    mockInviteLinkRepo.create.mockResolvedValue({
      id: 'i1', token: 'tok123', householdId: 'h1',
      expiresAt: new Date(Date.now() + 7 * 86_400_000),
    });
    const result = await service.createInviteLink({ userId: 'u1', householdId: 'h1', source: 'web' });
    expect(mockInviteLinkRepo.create).toHaveBeenCalled();
    expect(result.link).toContain('/join/tok123');
  });
});

describe('sendInviteLinkEmail', () => {
  it('throws NotFoundException if invite not found', async () => {
    mockInviteLinkRepo.findByToken.mockResolvedValue(null);
    await expect(
      service.sendInviteLinkEmail(
        { userId: 'u1', householdId: 'h1', source: 'web' },
        'i1', 'test@example.com'
      )
    ).rejects.toThrow(NotFoundException);
  });
});

describe('joinByToken', () => {
  it('throws NotFoundException for INVITE_NOT_FOUND', async () => {
    mockInviteLinkRepo.consumeAndJoin.mockRejectedValue(new Error('INVITE_NOT_FOUND'));
    await expect(service.joinByToken('u1', 'badtoken')).rejects.toThrow(NotFoundException);
  });

  it('throws GoneException for INVITE_USED', async () => {
    mockInviteLinkRepo.consumeAndJoin.mockRejectedValue(new Error('INVITE_USED'));
    await expect(service.joinByToken('u1', 'tok')).rejects.toThrow(GoneException);
  });
});
```

Add these imports at the top of the spec file:
```typescript
import { ForbiddenException, GoneException, NotFoundException } from '@nestjs/common';
```

Add `mockInviteLinkRepo` mock object to the spec setup (alongside existing mocks):
```typescript
const mockInviteLinkRepo = {
  create: vi.fn(),
  findByToken: vi.fn(),
  findActiveByHousehold: vi.fn(),
  consumeAndJoin: vi.fn(),
  delete: vi.fn(),
};
```

- [ ] **Step 2: Run tests to see them fail**

```bash
pnpm --filter api test households.service.spec
```

Expected: FAIL — methods `createInviteLink`, `sendInviteLinkEmail`, `joinByToken` not found

- [ ] **Step 3: Update `households.service.ts`**

Replace the file content, keeping existing methods and replacing the invite section:

```typescript
import {
  Injectable,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  NotFoundException,
  GoneException,
  Inject,
} from '@nestjs/common';
import type { Household, HouseholdMembership, InvitationLink } from '@prisma/client';
import { HouseholdRole } from '@prisma/client';
import type { RequestContext } from '../common/types/request-context.type';
import { HouseholdsRepository } from './households.repository';
import { InvitationLinkRepository } from './invitation-link.repository';
import { AuditService } from '../audit/audit.service';
import { MailService } from '../mail/mail.service';
import { ConfigType } from '@nestjs/config';
import { appConfig } from '../config/app.config';

export interface HouseholdWithRole {
  household: Household;
  role: HouseholdRole;
  joinedAt: Date;
}

export interface HouseholdMemberDetail {
  id: string;
  userId: string;
  displayName: string;
  email: string;
  role: HouseholdRole;
  joinedAt: Date;
}

export interface InviteLinkResponse {
  id: string;
  token: string;
  email: string | null;
  expiresAt: Date | null;
  usedAt: Date | null;
  createdAt: Date;
  link: string;
}

@Injectable()
export class HouseholdsService {
  constructor(
    private readonly repo: HouseholdsRepository,
    private readonly inviteLinkRepo: InvitationLinkRepository,
    private readonly auditService: AuditService,
    private readonly mailService: MailService,
    @Inject(appConfig.KEY) private readonly app: ConfigType<typeof appConfig>,
  ) {}

  private buildLink(token: string): string {
    return `${this.app.frontendUrl}/join/${token}`;
  }

  private toInviteLinkResponse(invite: InvitationLink): InviteLinkResponse {
    return {
      id:        invite.id,
      token:     invite.token,
      email:     invite.email,
      expiresAt: invite.expiresAt,
      usedAt:    invite.usedAt,
      createdAt: invite.createdAt,
      link:      this.buildLink(invite.token),
    };
  }

  createDefault(ownerId: string, name = 'Mein Haushalt'): Promise<Household> {
    return this.repo.createWithOwner({ name, ownerId });
  }

  async listForUser(userId: string): Promise<HouseholdWithRole[]> {
    const memberships = await this.repo.findMembershipsByUser(userId);
    return memberships.map((m) => ({
      household: m.household,
      role: m.role,
      joinedAt: m.joinedAt,
    }));
  }

  async getHousehold(ctx: RequestContext): Promise<Household> {
    const household = await this.repo.findById(ctx.householdId);
    if (!household) throw new NotFoundException('Haushalt nicht gefunden');
    return household;
  }

  async rename(ctx: RequestContext, name: string): Promise<Household> {
    const trimmed = name.trim();
    if (!trimmed) throw new BadRequestException('Name darf nicht leer sein');
    this.auditService.log({
      action: 'household.renamed',
      userId: ctx.userId,
      householdId: ctx.householdId,
    });
    return this.repo.updateName(ctx.householdId, trimmed);
  }

  async listMembers(ctx: RequestContext): Promise<HouseholdMemberDetail[]> {
    const memberships = await this.repo.findMembershipsByHousehold(ctx.householdId);
    return memberships.map((m) => ({
      id: m.id,
      userId: m.userId,
      displayName: m.user.displayName,
      email: m.user.email,
      role: m.role,
      joinedAt: m.joinedAt,
    }));
  }

  async removeMember(ctx: RequestContext, targetUserId: string): Promise<void> {
    if (targetUserId === ctx.userId) {
      throw new ForbiddenException('Eigene Mitgliedschaft kann nicht entfernt werden');
    }
    const callerMembership = await this.repo.findMembership(ctx.userId, ctx.householdId);
    if (!callerMembership || callerMembership.role !== HouseholdRole.OWNER) {
      throw new ForbiddenException('Nur der Eigentümer kann Mitglieder entfernen');
    }
    const targetMembership = await this.repo.findMembership(targetUserId, ctx.householdId);
    if (!targetMembership) throw new NotFoundException('Mitglied nicht gefunden');
    if (targetMembership.role === HouseholdRole.OWNER) {
      throw new ForbiddenException('Eigentümer kann nicht entfernt werden');
    }
    await this.repo.removeMember(targetUserId, ctx.householdId);
    this.auditService.log({
      action: 'member.removed',
      userId: ctx.userId,
      householdId: ctx.householdId,
      metadata: { targetUserId },
    });
  }

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

  async createInviteLink(
    ctx: RequestContext,
    opts: { expiresInDays?: number } = {},
  ): Promise<InviteLinkResponse> {
    const callerMembership = await this.repo.findMembership(ctx.userId, ctx.householdId);
    if (!callerMembership || callerMembership.role !== HouseholdRole.OWNER) {
      throw new ForbiddenException('Nur der Eigentümer kann Einladungen erstellen');
    }
    const expiresAt = new Date(
      Date.now() + (opts.expiresInDays ?? 7) * 86_400_000,
    );
    const invite = await this.inviteLinkRepo.create({
      householdId:     ctx.householdId,
      createdByUserId: ctx.userId,
      expiresAt,
    });
    this.auditService.log({
      action: 'member.invited',
      userId: ctx.userId,
      householdId: ctx.householdId,
    });
    return this.toInviteLinkResponse(invite);
  }

  async sendInviteLinkEmail(
    ctx: RequestContext,
    inviteId: string,
    email: string,
  ): Promise<void> {
    const callerMembership = await this.repo.findMembership(ctx.userId, ctx.householdId);
    if (!callerMembership || callerMembership.role !== HouseholdRole.OWNER) {
      throw new ForbiddenException('Nur der Eigentümer kann Einladungen versenden');
    }

    const invites = await this.inviteLinkRepo.findActiveByHousehold(ctx.householdId);
    const invite = invites.find(i => i.id === inviteId);
    if (!invite) throw new NotFoundException('Einladungslink nicht gefunden');

    const household = await this.repo.findById(ctx.householdId);
    const callerWithUser = await this.repo.findCallerWithUser(ctx.userId, ctx.householdId);

    const expiresAt = invite.expiresAt
      ? invite.expiresAt.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
      : 'unbegrenzt';

    await this.mailService.sendInviteEmail(email, {
      inviterName:   callerWithUser?.user?.displayName ?? 'Jemand',
      householdName: household?.name ?? '',
      inviteUrl:     this.buildLink(invite.token),
      expiresAt,
    });
  }

  async listInviteLinks(ctx: RequestContext): Promise<InviteLinkResponse[]> {
    const invites = await this.inviteLinkRepo.findActiveByHousehold(ctx.householdId);
    return invites.map(i => this.toInviteLinkResponse(i));
  }

  async deleteInviteLink(ctx: RequestContext, inviteId: string): Promise<void> {
    const callerMembership = await this.repo.findMembership(ctx.userId, ctx.householdId);
    if (!callerMembership || callerMembership.role !== HouseholdRole.OWNER) {
      throw new ForbiddenException('Nur der Eigentümer kann Einladungen löschen');
    }
    await this.inviteLinkRepo.delete(inviteId);
  }

  async getInviteInfo(token: string): Promise<{ householdName: string; expiresAt: string | null }> {
    const invite = await this.inviteLinkRepo.findByToken(token);
    if (!invite) throw new NotFoundException('Einladungslink nicht gefunden');
    if (invite.usedAt) throw new GoneException('Dieser Einladungslink wurde bereits verwendet');
    if (invite.expiresAt && invite.expiresAt < new Date()) {
      throw new GoneException('Dieser Einladungslink ist abgelaufen');
    }
    const household = await this.repo.findById(invite.householdId);
    return {
      householdName: household?.name ?? '',
      expiresAt: invite.expiresAt?.toISOString() ?? null,
    };
  }

  async joinByToken(userId: string, token: string): Promise<HouseholdMembership> {
    try {
      const result = await this.inviteLinkRepo.consumeAndJoin(token, userId);
      const membership = await this.repo.findMembership(userId, result.householdId);
      this.auditService.log({
        action: 'member.joined',
        userId,
        householdId: result.householdId,
      });
      return membership!;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg === 'INVITE_NOT_FOUND') throw new NotFoundException('Einladungslink nicht gefunden');
      if (msg === 'INVITE_USED') throw new GoneException('Dieser Einladungslink wurde bereits verwendet');
      if (msg === 'INVITE_EXPIRED') throw new GoneException('Dieser Einladungslink ist abgelaufen');
      if (msg === 'ALREADY_MEMBER') throw new BadRequestException('Du bist bereits Mitglied dieses Haushalts');
      throw err;
    }
  }

  async ensureMembership(userId: string, householdId: string): Promise<void> {
    const existing = await this.repo.findMembership(userId, householdId);
    if (!existing) {
      await this.repo.addMember(userId, householdId);
      this.auditService.log({ action: 'member.auto_joined', userId, householdId });
    }
  }

  async leave(ctx: RequestContext): Promise<void> {
    const membership = await this.repo.findMembership(ctx.userId, ctx.householdId);
    if (!membership) throw new NotFoundException('Mitgliedschaft nicht gefunden');
    if (membership.role === HouseholdRole.OWNER) {
      const ownerCount = await this.repo.countOwners(ctx.householdId);
      if (ownerCount <= 1) {
        throw new ForbiddenException('Der letzte Owner kann den Haushalt nicht verlassen.');
      }
    }
    await this.repo.removeMember(ctx.userId, ctx.householdId);
    this.auditService.log({ action: 'member.left', userId: ctx.userId, householdId: ctx.householdId });
  }

  async deleteHousehold(ctx: RequestContext): Promise<void> {
    const membership = await this.repo.findMembership(ctx.userId, ctx.householdId);
    if (!membership || membership.role !== HouseholdRole.OWNER) {
      throw new ForbiddenException('Nur der Eigentümer kann den Haushalt löschen');
    }
    const memberCount = await this.repo.countMembers(ctx.householdId);
    if (memberCount > 1) {
      throw new ForbiddenException('Haushalt mit mehreren Mitgliedern kann nicht gelöscht werden.');
    }
    await this.repo.deleteHousehold(ctx.householdId);
    this.auditService.log({ action: 'household.deleted', userId: ctx.userId, householdId: ctx.householdId });
  }
}
```

- [ ] **Step 4: Update `createDefault` to seed mail templates**

In `households.service.ts`, replace `createDefault`:

```typescript
async createDefault(ownerId: string, name = 'Mein Haushalt'): Promise<Household> {
  const household = await this.repo.createWithOwner({ name, ownerId });
  await this.repo.seedDefaultTemplates(household.id);
  return household;
}
```

- [ ] **Step 5: Run tests**

```bash
pnpm --filter api test households.service.spec
```

Expected: all tests PASS (existing + new ones)

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/households/households.service.ts
git commit -m "feat: replace InviteCode service methods with InvitationLink methods"
```

---

## Task 6: HouseholdsController — New Endpoints

**Files:**
- Modify: `apps/api/src/households/households.controller.ts`

- [ ] **Step 1: Replace the controller**

Replace the full content of `apps/api/src/households/households.controller.ts`:

```typescript
import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ReqContext } from '../common/decorators/req-context.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { JwtPayload } from '../common/types/jwt-payload.type';
import type { RequestContext } from '../common/types/request-context.type';
import { HouseholdRole } from '@prisma/client';
import { HouseholdMemberGuard } from './guards/household-member.guard';
import { HouseholdsService } from './households.service';

interface RenameBody { name: string }
interface CreateInviteBody { expiresInDays?: number }
interface SendInviteEmailBody { email: string }

@Controller()
export class HouseholdsController {
  constructor(private readonly householdsService: HouseholdsService) {}

  @Get('households')
  listMyHouseholds(@CurrentUser() user: JwtPayload) {
    return this.householdsService.listForUser(user.sub);
  }

  @Get('households/:hid')
  @UseGuards(HouseholdMemberGuard)
  getHousehold(@ReqContext() ctx: RequestContext) {
    return this.householdsService.getHousehold(ctx);
  }

  @Patch('households/:hid')
  @UseGuards(HouseholdMemberGuard)
  renameHousehold(
    @ReqContext() ctx: RequestContext,
    @Body() body: RenameBody,
  ) {
    return this.householdsService.rename(ctx, body.name);
  }

  @Get('households/:hid/members')
  @UseGuards(HouseholdMemberGuard)
  listMembers(@ReqContext() ctx: RequestContext) {
    return this.householdsService.listMembers(ctx);
  }

  @Delete('households/:hid/members/:uid')
  @UseGuards(HouseholdMemberGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  removeMember(
    @ReqContext() ctx: RequestContext,
    @Param('uid') targetUserId: string,
  ) {
    return this.householdsService.removeMember(ctx, targetUserId);
  }

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

  @Get('households/:hid/invites')
  @UseGuards(HouseholdMemberGuard)
  listInvites(@ReqContext() ctx: RequestContext) {
    return this.householdsService.listInviteLinks(ctx);
  }

  @Post('households/:hid/invites')
  @UseGuards(HouseholdMemberGuard)
  createInvite(
    @ReqContext() ctx: RequestContext,
    @Body() body: CreateInviteBody,
  ) {
    return this.householdsService.createInviteLink(ctx, { expiresInDays: body.expiresInDays });
  }

  @Post('households/:hid/invites/:iid/send')
  @UseGuards(HouseholdMemberGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  sendInviteEmail(
    @ReqContext() ctx: RequestContext,
    @Param('iid') inviteId: string,
    @Body() body: SendInviteEmailBody,
  ) {
    return this.householdsService.sendInviteLinkEmail(ctx, inviteId, body.email);
  }

  @Delete('households/:hid/invites/:iid')
  @UseGuards(HouseholdMemberGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteInvite(
    @ReqContext() ctx: RequestContext,
    @Param('iid') inviteId: string,
  ) {
    return this.householdsService.deleteInviteLink(ctx, inviteId);
  }

  @Public()
  @Get('join/:token')
  getInviteInfo(@Param('token') token: string) {
    return this.householdsService.getInviteInfo(token);
  }

  @Post('join/:token')
  @HttpCode(HttpStatus.OK)
  joinByToken(
    @CurrentUser() user: JwtPayload,
    @Param('token') token: string,
  ) {
    return this.householdsService.joinByToken(user.sub, token);
  }

  @Delete('households/:hid/leave')
  @UseGuards(HouseholdMemberGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  leaveHousehold(@ReqContext() ctx: RequestContext) {
    return this.householdsService.leave(ctx);
  }

  @Delete('households/:hid')
  @UseGuards(HouseholdMemberGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteHousehold(@ReqContext() ctx: RequestContext) {
    return this.householdsService.deleteHousehold(ctx);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/households/households.controller.ts
git commit -m "feat: update HouseholdsController for invitation links"
```

---

## Task 7: HouseholdsModule + Pino Redaction

**Files:**
- Modify: `apps/api/src/households/households.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Update `households.module.ts`**

Replace the file:

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { appConfig } from '../config/app.config';
import { HouseholdsRepository } from './households.repository';
import { InvitationLinkRepository } from './invitation-link.repository';
import { HouseholdsService } from './households.service';
import { HouseholdsController } from './households.controller';
import { HouseholdMemberGuard } from './guards/household-member.guard';

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    ConfigModule.forFeature(appConfig),
  ],
  providers: [
    HouseholdsService,
    HouseholdsRepository,
    InvitationLinkRepository,
    HouseholdMemberGuard,
  ],
  controllers: [HouseholdsController],
  exports: [HouseholdsService, HouseholdsRepository],
})
export class HouseholdsModule {}
```

- [ ] **Step 2: Add `inviteToken` to Pino redaction in `app.module.ts`**

In `apps/api/src/app.module.ts`, find the `redact` array and add `'req.params.token'` to it:

```typescript
redact: [
  'req.headers.authorization',
  'req.params.token',       // ← add this line
  'req.body.password',
  // ... rest unchanged
],
```

- [ ] **Step 3: Build to check for TypeScript errors**

```bash
pnpm --filter api build
```

Expected: build succeeds with no errors

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/households/households.module.ts apps/api/src/app.module.ts
git commit -m "feat: wire InvitationLinkRepository into HouseholdsModule"
```

---

## Task 8: Shared Types

**Files:**
- Modify: `packages/shared/src/types.ts`

- [ ] **Step 1: Replace InviteCode types in `types.ts`**

Find and replace the `InviteCode`, `CreateInviteRequest`, and `JoinHouseholdRequest` types:

```typescript
// Replace:
export type InviteCode = {
  id: string;
  householdId: string;
  code: string;
  createdByUserId: string | null;
  expiresAt: string | null;
  usesRemaining: number | null;
  createdAt: string;
};

export type CreateInviteRequest = {
  expiresInDays?: number;
  maxUses?: number;
};

export type JoinHouseholdRequest = {
  code: string;
};

// With:
export type InvitationLink = {
  id: string;
  token: string;
  email: string | null;
  expiresAt: string | null;
  usedAt: string | null;
  createdAt: string;
  link: string;
};

export type CreateInviteLinkRequest = {
  expiresInDays?: number;
};

export type InviteTokenInfo = {
  householdName: string;
  expiresAt: string | null;
};
```

- [ ] **Step 2: Update the shared index if needed**

```bash
grep -r "InviteCode\|CreateInviteRequest\|JoinHouseholdRequest" packages/shared/src/
```

Update any re-exports in `packages/shared/src/index.ts` to export the new types.

- [ ] **Step 3: Build shared package**

```bash
pnpm --filter @klar/shared build
```

Expected: builds successfully

- [ ] **Step 4: Commit**

```bash
git add packages/shared/
git commit -m "feat: replace InviteCode shared types with InvitationLink types"
```

---

## Task 9: Frontend HouseholdService + HouseholdStore

**Files:**
- Modify: `apps/web/src/app/core/household/household.service.ts`
- Modify: `apps/web/src/app/core/household/household.store.ts`

- [ ] **Step 1: Update `household.service.ts`**

Replace the full file:

```typescript
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type {
  Household,
  HouseholdMember,
  HouseholdWithRole,
  InvitationLink,
  CreateInviteLinkRequest,
  InviteTokenInfo,
} from '@klar/shared';

const BASE = '/api/v1/households';

@Injectable({ providedIn: 'root' })
export class HouseholdService {
  private http = inject(HttpClient);

  listMyHouseholds(): Promise<HouseholdWithRole[]> {
    return firstValueFrom(this.http.get<HouseholdWithRole[]>(BASE));
  }

  getHousehold(hid: string): Promise<Household> {
    return firstValueFrom(this.http.get<Household>(`${BASE}/${hid}`));
  }

  renameHousehold(hid: string, name: string): Promise<Household> {
    return firstValueFrom(this.http.patch<Household>(`${BASE}/${hid}`, { name }));
  }

  listMembers(hid: string): Promise<HouseholdMember[]> {
    return firstValueFrom(this.http.get<HouseholdMember[]>(`${BASE}/${hid}/members`));
  }

  removeMember(hid: string, userId: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${BASE}/${hid}/members/${userId}`));
  }

  changeMemberRole(hid: string, userId: string, role: 'OWNER' | 'MEMBER'): Promise<void> {
    return firstValueFrom(
      this.http.patch<void>(`${BASE}/${hid}/members/${userId}`, { role }),
    );
  }

  listInvites(hid: string): Promise<InvitationLink[]> {
    return firstValueFrom(this.http.get<InvitationLink[]>(`${BASE}/${hid}/invites`));
  }

  createInvite(hid: string, body: CreateInviteLinkRequest = {}): Promise<InvitationLink> {
    return firstValueFrom(this.http.post<InvitationLink>(`${BASE}/${hid}/invites`, body));
  }

  sendInviteEmail(hid: string, inviteId: string, email: string): Promise<void> {
    return firstValueFrom(
      this.http.post<void>(`${BASE}/${hid}/invites/${inviteId}/send`, { email }),
    );
  }

  deleteInvite(hid: string, inviteId: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${BASE}/${hid}/invites/${inviteId}`));
  }

  getInviteInfo(token: string): Promise<InviteTokenInfo> {
    return firstValueFrom(this.http.get<InviteTokenInfo>(`/api/v1/join/${token}`));
  }

  joinByToken(token: string): Promise<{ householdId: string }> {
    return firstValueFrom(
      this.http.post<{ householdId: string }>(`/api/v1/join/${token}`, {}),
    );
  }

  leaveHousehold(hid: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${BASE}/${hid}/leave`));
  }

  deleteHousehold(hid: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${BASE}/${hid}`));
  }
}
```

- [ ] **Step 2: Update `household.store.ts`**

In `household.store.ts`, replace:
- `import type { ... InviteCode ... }` → `import type { ... InvitationLink ... }`
- `private _invites = signal<InviteCode[]>([])` → `private _invites = signal<InvitationLink[]>([])`
- `readonly invites = this._invites.asReadonly()` — type changes to `InvitationLink[]`
- `createInvite(opts: { expiresInDays?: number; maxUses?: number })` → `createInvite(opts: { expiresInDays?: number })`
- Remove `joinByCode` method entirely
- Add `joinByToken` method:

```typescript
async joinByToken(token: string): Promise<void> {
  await this.householdService.joinByToken(token);
  await this.loadHouseholds();
  await this.router.navigate(['/app']);
}
```

- [ ] **Step 3: Build to check TypeScript**

```bash
pnpm --filter web build 2>&1 | head -50
```

Expected: no TypeScript errors from store/service files

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/core/household/
git commit -m "feat: update HouseholdService and HouseholdStore for InvitationLink"
```

---

## Task 10: InviteDialog Component

**Files:**
- Create: `apps/web/src/app/pages/haushalt/invite-dialog.component.ts`
- Create: `apps/web/src/app/pages/haushalt/invite-dialog.component.html`

- [ ] **Step 1: Create `invite-dialog.component.ts`**

```typescript
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { KlarDialogService } from '../../shared/ui/klar-dialog.service';
import { HlmButtonDirective } from '../../shared/ui/hlm/hlm-button.directive';
import { HlmSpinnerComponent } from '../../shared/ui/hlm/hlm-spinner.component';
import { HlmInputDirective } from '../../shared/ui/hlm/hlm-input.directive';
import { HlmLabelDirective } from '../../shared/ui/hlm/hlm-label.directive';
import { HouseholdStore } from '../../core/household/household.store';
import { HouseholdService } from '../../core/household/household.service';
import { KlarToastService } from '../../shared/ui/klar-toast.service';
import type { InvitationLink } from '@klar/shared';

@Component({
  selector: 'app-invite-dialog',
  standalone: true,
  imports: [FormsModule, HlmButtonDirective, HlmSpinnerComponent, HlmInputDirective, HlmLabelDirective],
  templateUrl: './invite-dialog.component.html',
})
export class InviteDialogComponent implements OnInit {
  private dialog         = inject(KlarDialogService);
  private store          = inject(HouseholdStore);
  private householdSvc   = inject(HouseholdService);
  private toast          = inject(KlarToastService);

  readonly invite        = signal<InvitationLink | null>(null);
  readonly loading       = signal(true);
  readonly emailInput    = signal('');
  readonly sending       = signal(false);
  readonly emailSent     = signal(false);
  readonly regenerating  = signal(false);

  async ngOnInit(): Promise<void> {
    await this.loadFreshInvite();
  }

  private async loadFreshInvite(): Promise<void> {
    this.loading.set(true);
    try {
      const hid = this.store.activeId()!;
      const created = await this.householdSvc.createInvite(hid);
      this.invite.set(created);
      this.store['_invites'].update((list: InvitationLink[]) => [created, ...list]);
    } catch {
      this.toast.error('Einladungslink konnte nicht erstellt werden');
    } finally {
      this.loading.set(false);
    }
  }

  async sendEmail(): Promise<void> {
    const email = this.emailInput().trim();
    const inv = this.invite();
    if (!email || !inv) return;
    this.sending.set(true);
    try {
      const hid = this.store.activeId()!;
      await this.householdSvc.sendInviteEmail(hid, inv.id, email);
      this.emailSent.set(true);
      this.toast.success(`Einladung an ${email} gesendet`);
    } catch {
      this.toast.error('E-Mail konnte nicht gesendet werden');
    } finally {
      this.sending.set(false);
    }
  }

  async copyLink(): Promise<void> {
    const inv = this.invite();
    if (!inv) return;
    try {
      await navigator.clipboard.writeText(inv.link);
      this.toast.success('Link kopiert');
    } catch {
      this.toast.error('Kopieren fehlgeschlagen');
    }
  }

  async shareLink(): Promise<void> {
    const inv = this.invite();
    if (!inv) return;
    if ('share' in navigator) {
      try {
        await navigator.share({ title: 'Klar einladen', url: inv.link });
      } catch {
        // user dismissed share sheet — not an error
      }
    } else {
      await this.copyLink();
    }
  }

  async regenerate(): Promise<void> {
    const old = this.invite();
    if (!old) return;
    this.regenerating.set(true);
    try {
      const hid = this.store.activeId()!;
      await this.householdSvc.deleteInvite(hid, old.id);
      this.store['_invites'].update((list: InvitationLink[]) => list.filter(i => i.id !== old.id));
      this.emailSent.set(false);
      this.emailInput.set('');
      await this.loadFreshInvite();
    } catch {
      this.toast.error('Neu generieren fehlgeschlagen');
    } finally {
      this.regenerating.set(false);
    }
  }

  close(): void {
    this.dialog.close();
  }
}
```

- [ ] **Step 2: Create `invite-dialog.component.html`**

```html
<div class="flex flex-col gap-5 p-1">

  @if (loading()) {
    <div class="flex justify-center py-8">
      <hlm-spinner />
    </div>
  } @else {

    <!-- E-Mail section -->
    <div class="flex flex-col gap-2">
      <label hlmLabel class="text-[10px] uppercase tracking-widest text-muted-foreground">
        Per E-Mail einladen
      </label>
      <div class="flex gap-2">
        <input
          hlmInput
          type="email"
          class="flex-1 text-base"
          placeholder="email@beispiel.de"
          [ngModel]="emailInput()"
          (ngModelChange)="emailInput.set($event)"
        />
        <button
          hlmBtn
          variant="default"
          [disabled]="!emailInput().trim() || sending()"
          (click)="sendEmail()"
        >
          @if (sending()) { <hlm-spinner size="sm" class="mr-2" /> }
          Senden
        </button>
      </div>
      @if (emailSent()) {
        <p class="text-xs text-success">Einladung wurde gesendet.</p>
      }
    </div>

    <!-- Divider -->
    <div class="flex items-center gap-3 text-muted-foreground text-xs">
      <div class="flex-1 h-px bg-border"></div>
      oder Link direkt teilen
      <div class="flex-1 h-px bg-border"></div>
    </div>

    <!-- Link section -->
    <div class="flex flex-col gap-2">
      <label hlmLabel class="text-[10px] uppercase tracking-widest text-muted-foreground">
        Einladungslink
      </label>
      <div class="flex gap-2">
        <input
          hlmInput
          class="flex-1 text-xs text-muted-foreground"
          [value]="invite()?.link ?? ''"
          readonly
        />
        <button hlmBtn variant="outline" (click)="copyLink()">Kopieren</button>
      </div>
      <div class="flex gap-2">
        <button hlmBtn variant="outline" class="flex-1" (click)="shareLink()">
          ↗ Teilen
        </button>
        <button
          hlmBtn
          variant="outline"
          class="flex-1"
          [disabled]="regenerating()"
          (click)="regenerate()"
        >
          @if (regenerating()) { <hlm-spinner size="sm" class="mr-2" /> }
          Neu generieren
        </button>
      </div>
      <p class="text-xs text-muted-foreground">
        Gültig 7 Tage · Einmalig verwendbar
      </p>
    </div>

  }

  <div class="flex justify-end pt-2 border-t border-border">
    <button hlmBtn variant="ghost" (click)="close()">Schließen</button>
  </div>

</div>
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/pages/haushalt/invite-dialog.component.*
git commit -m "feat: add InviteDialogComponent"
```

---

## Task 11: HaushaltComponent — Replace Old Invite UI

**Files:**
- Modify: `apps/web/src/app/pages/haushalt/haushalt.component.ts`
- Modify: `apps/web/src/app/pages/haushalt/haushalt.component.html`

- [ ] **Step 1: Update `haushalt.component.ts`**

Replace invite-related code in the component:

1. Remove imports: `InviteCode` from `@klar/shared`
2. Add imports: `KlarDialogService`, `InviteDialogComponent`
3. Remove signals: `creatingInvite`, `newlyCreatedInvite`, `joinCode`, `joining`
4. Remove methods: `createInvite`, `deleteInvite` (single), `joinByCode`, `formatCode`, `formatInviteSublabel`, `copyCode`
5. Inject `KlarDialogService`
6. Add method:

```typescript
openInviteDialog(): void {
  this.dialog.open({ title: 'Mitglied einladen', component: InviteDialogComponent });
}
```

Where `dialog = inject(KlarDialogService)`.

- [ ] **Step 2: Update `haushalt.component.html`**

Find the invite section in the template. Replace the entire invite code block (code input, created invite display) with a single button:

```html
@if (canManage()) {
  <button hlmBtn variant="outline" (click)="openInviteDialog()">
    Mitglied einladen
  </button>
}
```

Also remove the "Haushalt beitreten" / code-input section — the `/join/:token` page handles joining now.

- [ ] **Step 3: Build and check**

```bash
pnpm --filter web build 2>&1 | grep -E "error|Error" | head -20
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/pages/haushalt/
git commit -m "feat: replace invite code UI with InviteDialogComponent"
```

---

## Task 12: JoinPage — /join/:token

**Files:**
- Create: `apps/web/src/app/pages/join/join.component.ts`
- Create: `apps/web/src/app/pages/join/join.component.html`
- Modify: `apps/web/src/app/app.routes.ts`

- [ ] **Step 1: Create `join.component.ts`**

```typescript
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { KlarWordmarkComponent } from '../../shared/brand/klar-wordmark.component';
import { HlmButtonDirective } from '../../shared/ui/hlm/hlm-button.directive';
import { HlmLoadingBtnDirective } from '../../shared/ui/hlm/hlm-loading-btn.directive';
import { HlmSpinnerComponent } from '../../shared/ui/hlm/hlm-spinner.component';
import { AuthStore } from '../../core/auth/auth.store';
import { HouseholdService } from '../../core/household/household.service';
import { HouseholdStore } from '../../core/household/household.store';
import type { InviteTokenInfo } from '@klar/shared';

export const PENDING_INVITE_KEY = 'pendingInviteToken';

@Component({
  selector: 'app-join',
  standalone: true,
  imports: [RouterLink, KlarWordmarkComponent, HlmButtonDirective, HlmLoadingBtnDirective, HlmSpinnerComponent],
  templateUrl: './join.component.html',
})
export class JoinComponent implements OnInit {
  private route           = inject(ActivatedRoute);
  private router          = inject(Router);
  private authStore       = inject(AuthStore);
  private householdSvc    = inject(HouseholdService);
  private householdStore  = inject(HouseholdStore);

  readonly loading        = signal(true);
  readonly joining        = signal(false);
  readonly info           = signal<InviteTokenInfo | null>(null);
  readonly errorMessage   = signal<string | null>(null);
  readonly token          = signal('');

  async ngOnInit(): Promise<void> {
    const t = this.route.snapshot.paramMap.get('token') ?? '';
    this.token.set(t);

    try {
      const data = await this.householdSvc.getInviteInfo(t);
      this.info.set(data);
    } catch (err: unknown) {
      const status = (err as { status?: number }).status;
      if (status === 404) {
        this.errorMessage.set('Dieser Einladungslink ist ungültig.');
      } else if (status === 410) {
        this.errorMessage.set('Dieser Einladungslink wurde bereits verwendet oder ist abgelaufen.');
      } else {
        this.errorMessage.set('Einladungslink konnte nicht geladen werden.');
      }
    } finally {
      this.loading.set(false);
    }
  }

  get isAuthenticated(): boolean {
    return !!this.authStore.user();
  }

  async join(): Promise<void> {
    this.joining.set(true);
    try {
      await this.householdSvc.joinByToken(this.token());
      await this.householdStore.loadHouseholds();
      await this.router.navigate(['/app']);
    } catch (err: unknown) {
      const status = (err as { status?: number }).status;
      if (status === 410) {
        this.errorMessage.set('Dieser Einladungslink wurde bereits verwendet oder ist abgelaufen.');
      } else if (status === 409) {
        this.errorMessage.set('Du bist bereits Mitglied dieses Haushalts.');
        setTimeout(() => this.router.navigate(['/app']), 2000);
      } else {
        this.errorMessage.set('Beitreten fehlgeschlagen. Bitte versuche es erneut.');
      }
    } finally {
      this.joining.set(false);
    }
  }

  goToRegister(): void {
    sessionStorage.setItem(PENDING_INVITE_KEY, this.token());
    void this.router.navigate(['/register'], { queryParams: { invite: this.token() } });
  }

  goToLogin(): void {
    sessionStorage.setItem(PENDING_INVITE_KEY, this.token());
    void this.router.navigate(['/login'], { queryParams: { invite: this.token() } });
  }
}
```

- [ ] **Step 2: Create `join.component.html`**

```html
<div class="min-h-[100dvh] flex flex-col items-center justify-center bg-background px-4">
  <div class="w-full max-w-sm flex flex-col gap-8">

    <div class="flex justify-center">
      <klar-wordmark />
    </div>

    @if (loading()) {
      <div class="flex justify-center">
        <hlm-spinner />
      </div>
    } @else if (errorMessage()) {
      <div class="flex flex-col gap-4 items-center text-center">
        <p class="text-danger text-sm">{{ errorMessage() }}</p>
        <a [routerLink]="['/login']" hlmBtn variant="outline">Zur Anmeldung</a>
      </div>
    } @else {
      <div class="flex flex-col gap-6">
        <div class="text-center">
          <h1 class="text-xl font-semibold text-foreground">Du wurdest eingeladen</h1>
          <p class="mt-2 text-sm text-muted-foreground">
            Tritt dem Haushalt <strong class="text-foreground">{{ info()?.householdName }}</strong> bei.
          </p>
        </div>

        @if (isAuthenticated) {
          <button
            hlmBtn
            class="w-full"
            [klarLoadingBtn]="joining()"
            (click)="join()"
          >
            Haushalt beitreten
          </button>
        } @else {
          <div class="flex flex-col gap-3">
            <button hlmBtn class="w-full" (click)="goToRegister()">
              Registrieren &amp; beitreten
            </button>
            <button hlmBtn variant="outline" class="w-full" (click)="goToLogin()">
              Anmelden &amp; beitreten
            </button>
          </div>
          <p class="text-xs text-muted-foreground text-center">
            Nach der Registrierung wirst du automatisch zum Haushalt hinzugefügt.
          </p>
        }
      </div>
    }
  </div>
</div>
```

- [ ] **Step 3: Add `/join/:token` route to `app.routes.ts`**

In `apps/web/src/app/app.routes.ts`, add before the `'**'` wildcard route:

```typescript
{
  path: 'join/:token',
  loadComponent: () =>
    import('./pages/join/join.component').then(m => m.JoinComponent),
},
```

Note: no `authGuard` or `guestGuard` — this route must be accessible regardless of auth state.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/pages/join/ apps/web/src/app/app.routes.ts
git commit -m "feat: add /join/:token page for invitation links"
```

---

## Task 13: Register + Login — Auto-Consume Pending Invite Token

**Files:**
- Modify: `apps/web/src/app/pages/register/register.component.ts`
- Modify: `apps/web/src/app/pages/login/login.component.ts`

- [ ] **Step 1: Update `register.component.ts`**

1. Add imports at the top:

```typescript
import { ActivatedRoute, Router } from '@angular/router';
import { HouseholdService } from '../../core/household/household.service';
import { HouseholdStore } from '../../core/household/household.store';
import { PENDING_INVITE_KEY } from '../join/join.component';
```

2. Inject services:

```typescript
private route          = inject(ActivatedRoute);
private router         = inject(Router);
private householdSvc   = inject(HouseholdService);
private householdStore = inject(HouseholdStore);
```

3. On init, read query param:

```typescript
ngOnInit(): void {
  const token = this.route.snapshot.queryParamMap.get('invite');
  if (token) sessionStorage.setItem(PENDING_INVITE_KEY, token);
}
```

4. Add `implements OnInit` to the class declaration.

5. Replace the `this.success.set(true)` line in `submit()` with auto-consume logic:

```typescript
// After successful registration response:
const pendingToken = sessionStorage.getItem(PENDING_INVITE_KEY);
if (pendingToken) {
  // User must verify email first — store token, redirect to verify-email page
  // The join happens after they log in from the join page
  this.success.set(true);
} else {
  this.success.set(true);
}
```

Note: Registration requires email verification before login is possible. The token stays in `sessionStorage` until the user logs in after verifying.

- [ ] **Step 2: Update `login.component.ts`**

1. Add imports:

```typescript
import { HouseholdService } from '../../core/household/household.service';
import { HouseholdStore } from '../../core/household/household.store';
import { PENDING_INVITE_KEY } from '../join/join.component';
```

2. Inject at class body:

```typescript
private householdSvc   = inject(HouseholdService);
private householdStore = inject(HouseholdStore);
```

3. On `ngOnInit`, read `?invite=` param:

```typescript
ngOnInit(): void {
  const token = this.route.snapshot.queryParamMap.get('invite');
  if (token) sessionStorage.setItem(PENDING_INVITE_KEY, token);
  // ... existing ngOnInit logic
}
```

4. After successful login (after `this.authStore` is updated and before `router.navigate`), add:

```typescript
const pendingToken = sessionStorage.getItem(PENDING_INVITE_KEY);
if (pendingToken) {
  sessionStorage.removeItem(PENDING_INVITE_KEY);
  try {
    await this.householdSvc.joinByToken(pendingToken);
    await this.householdStore.loadHouseholds();
  } catch {
    // Token may be expired — proceed to app anyway
  }
}
```

- [ ] **Step 3: Build and check TypeScript**

```bash
pnpm --filter web build 2>&1 | grep -E "error|Error" | head -20
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/pages/register/ apps/web/src/app/pages/login/
git commit -m "feat: auto-consume pending invite token after register/login"
```

---

## Task 14: E2E Integration Tests

**Files:**
- Modify: `apps/api/src/households/households.e2e.spec.ts`

- [ ] **Step 1: Add invite link E2E tests**

Append to `apps/api/src/households/households.e2e.spec.ts`:

```typescript
describe('Invitation Links', () => {
  let ownerTokens: AuthTokens;
  let inviteeTokens: AuthTokens;
  let householdId: string;

  beforeAll(async () => {
    ownerTokens  = await registerAndLogin(app, 'invite-owner@test.com');
    inviteeTokens = await registerAndLogin(app, 'invite-invitee@test.com');
    const hRes = await app.inject({
      method: 'GET', url: '/api/v1/households',
      headers: { authorization: `Bearer ${ownerTokens.accessToken}` },
    });
    householdId = (JSON.parse(hRes.body) as Array<{ household: { id: string } }>)[0].household.id;
  });

  it('POST /households/:hid/invites creates a link (owner only)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/households/${householdId}/invites`,
      headers: { authorization: `Bearer ${ownerTokens.accessToken}` },
      payload: { expiresInDays: 7 },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body) as { token: string; link: string };
    expect(body.token).toBeDefined();
    expect(body.link).toContain('/join/');
  });

  it('GET /join/:token returns household name (public)', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: `/api/v1/households/${householdId}/invites`,
      headers: { authorization: `Bearer ${ownerTokens.accessToken}` },
      payload: {},
    });
    const { token } = JSON.parse(createRes.body) as { token: string };

    const res = await app.inject({ method: 'GET', url: `/api/v1/join/${token}` });
    expect(res.statusCode).toBe(200);
    const info = JSON.parse(res.body) as { householdName: string };
    expect(info.householdName).toBeDefined();
  });

  it('POST /join/:token joins household and marks link used', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: `/api/v1/households/${householdId}/invites`,
      headers: { authorization: `Bearer ${ownerTokens.accessToken}` },
      payload: {},
    });
    const { token } = JSON.parse(createRes.body) as { token: string };

    const joinRes = await app.inject({
      method: 'POST',
      url: `/api/v1/join/${token}`,
      headers: { authorization: `Bearer ${inviteeTokens.accessToken}` },
    });
    expect(joinRes.statusCode).toBe(200);

    // Second attempt returns 410
    const dupRes = await app.inject({
      method: 'POST',
      url: `/api/v1/join/${token}`,
      headers: { authorization: `Bearer ${inviteeTokens.accessToken}` },
    });
    expect(dupRes.statusCode).toBe(410);
  });

  it('GET /join/bad-token returns 404', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/join/nonexistent-token-xyz' });
    expect(res.statusCode).toBe(404);
  });

  it('POST /join/:token with another user token returns cross-tenant isolation', async () => {
    const otherOwner = await registerAndLogin(app, 'invite-other@test.com');
    const otherHRes = await app.inject({
      method: 'GET', url: '/api/v1/households',
      headers: { authorization: `Bearer ${otherOwner.accessToken}` },
    });
    const otherHid = (JSON.parse(otherHRes.body) as Array<{ household: { id: string } }>)[0].household.id;

    // Create invite for other household
    const createRes = await app.inject({
      method: 'POST',
      url: `/api/v1/households/${otherHid}/invites`,
      headers: { authorization: `Bearer ${otherOwner.accessToken}` },
      payload: {},
    });
    const { token } = JSON.parse(createRes.body) as { token: string };

    // inviteeTokens should be able to use it (cross-tenant join is intentional via invite)
    // but cannot create invites for that household (403)
    const forbiddenRes = await app.inject({
      method: 'POST',
      url: `/api/v1/households/${otherHid}/invites`,
      headers: { authorization: `Bearer ${inviteeTokens.accessToken}` },
      payload: {},
    });
    expect(forbiddenRes.statusCode).toBe(403);
  });
});
```

- [ ] **Step 2: Run E2E tests**

```bash
pnpm --filter api test:e2e
```

Expected: all new tests PASS

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/households/households.e2e.spec.ts
git commit -m "test: add E2E tests for invitation links"
```

---

## Task 15: Final Build + Verification

- [ ] **Step 1: Full build**

```bash
pnpm build
```

Expected: all packages build successfully

- [ ] **Step 2: Run all unit tests**

```bash
pnpm test
```

Expected: all tests PASS

- [ ] **Step 3: Run E2E tests**

```bash
pnpm --filter api test:e2e
```

Expected: all PASS

- [ ] **Step 4: TypeScript strict check**

```bash
pnpm --filter web tsc --noEmit
pnpm --filter api tsc --noEmit
```

Expected: no errors

- [ ] **Step 5: Manual smoke test**

Start the app:
```bash
docker compose -f docker/docker-compose.dev.yml up -d
pnpm dev
```

1. Log in as owner → go to Haushalt → click "Mitglied einladen"
2. Verify dialog opens with a pre-generated link
3. Click "Kopieren" → verify toast "Link kopiert"
4. Open the link in a new incognito window → verify `/join/:token` page shows household name
5. Click "Registrieren & beitreten" → verify redirect to `/register?invite=TOKEN`
6. Complete registration → verify token consumed → verify redirect to `/app`
7. Back in owner window → verify new member appears in members list

- [ ] **Step 6: Final commit**

```bash
git add .
git commit -m "feat: complete invitation links feature"
```
