import {
  Injectable,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  NotFoundException,
  GoneException,
  Inject,
} from '@nestjs/common';
import type { Household, HouseholdMembership } from '@prisma/client';
import { HouseholdRole } from '@prisma/client';
import type { RequestContext } from '../common/types/request-context.type';
import { HouseholdsRepository } from './households.repository';
import { InvitationLinkRepository } from './invitation-link.repository';
import { AuditService } from '../audit/audit.service';
import { MailService } from '../mail/mail.service';
import { appConfig } from '../config/app.config';
import type { ConfigType } from '@nestjs/config';

// Local type until Prisma client regenerates
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
  avatarUrl: string | null;
  role: HouseholdRole;
  joinedAt: Date;
}

export interface InviteLinkWithUrl extends InvitationLink {
  link: string;
}

export interface InviteTokenInfo {
  householdName: string;
  expiresAt: string | null;
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

  async createDefault(ownerId: string, name = 'Mein Haushalt'): Promise<Household> {
    const household = await this.repo.createWithOwner({ name, ownerId });
    await this.repo.seedDefaultTemplates(household.id);
    return household;
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
      avatarUrl: (m.user as { avatarUrl?: string | null }).avatarUrl ?? null,
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

  // ─── Invitation Links ─────────────────────────────────────────────────────

  private buildInviteUrl(token: string): string {
    return `${this.app.frontendUrl}/join/${token}`;
  }

  private withUrl(link: InvitationLink): InviteLinkWithUrl {
    return { ...link, link: this.buildInviteUrl(link.token) };
  }

  async createInviteLink(
    ctx: RequestContext,
    opts: { expiresInDays?: number; email?: string } = {},
  ): Promise<InviteLinkWithUrl> {
    const callerMembership = await this.repo.findMembership(ctx.userId, ctx.householdId);
    if (!callerMembership || callerMembership.role !== HouseholdRole.OWNER) {
      throw new ForbiddenException('Nur der Eigentümer kann Einladungslinks erstellen');
    }
    const expiresAt = opts.expiresInDays
      ? new Date(Date.now() + opts.expiresInDays * 86_400_000)
      : new Date(Date.now() + 7 * 86_400_000); // default 7 Tage
    const link = await this.inviteLinkRepo.create({
      householdId: ctx.householdId,
      createdByUserId: ctx.userId,
      email: opts.email,
      expiresAt,
    });
    this.auditService.log({
      action: 'member.invited',
      userId: ctx.userId,
      householdId: ctx.householdId,
      metadata: { inviteToken: link.token.slice(0, 8) + '…' },
    });
    return this.withUrl(link);
  }

  async sendInviteLinkEmail(
    ctx: RequestContext,
    inviteId: string,
    email: string,
  ): Promise<void> {
    const callerMembership = await this.repo.findCallerWithUser(ctx.userId, ctx.householdId);
    if (!callerMembership || callerMembership.role !== HouseholdRole.OWNER) {
      throw new ForbiddenException('Nur der Eigentümer kann Einladungen versenden');
    }
    const links = await this.inviteLinkRepo.findByHousehold(ctx.householdId);
    const link = links.find(l => l.id === inviteId);
    if (!link) throw new NotFoundException('Einladungslink nicht gefunden');
    if (link.usedAt) throw new GoneException('Einladungslink wurde bereits verwendet');

    const household = await this.repo.findById(ctx.householdId);
    const inviterName = callerMembership.user.displayName;
    const householdName = household?.name ?? 'Klar';
    const inviteUrl = this.buildInviteUrl(link.token);

    await this.mailService.sendInviteEmail(
      email,
      inviterName,
      householdName,
      inviteUrl,
      link.expiresAt ?? undefined,
    );
  }

  async listInviteLinks(ctx: RequestContext): Promise<InviteLinkWithUrl[]> {
    const links = await this.inviteLinkRepo.findByHousehold(ctx.householdId);
    return links.map(l => this.withUrl(l));
  }

  async deleteInviteLink(ctx: RequestContext, inviteId: string): Promise<void> {
    const callerMembership = await this.repo.findMembership(ctx.userId, ctx.householdId);
    if (!callerMembership || callerMembership.role !== HouseholdRole.OWNER) {
      throw new ForbiddenException('Nur der Eigentümer kann Einladungslinks löschen');
    }
    await this.inviteLinkRepo.delete(inviteId);
  }

  async getInviteInfo(token: string): Promise<InviteTokenInfo> {
    const link = await this.inviteLinkRepo.findByToken(token);
    if (!link) throw new NotFoundException('Einladungslink nicht gefunden');
    if (link.usedAt) throw new GoneException('Einladungslink wurde bereits verwendet');
    if (link.expiresAt && link.expiresAt < new Date()) throw new GoneException('Einladungslink ist abgelaufen');

    const household = await this.repo.findById(link.householdId);
    return {
      householdName: household?.name ?? 'Klar',
      expiresAt: link.expiresAt?.toISOString() ?? null,
    };
  }

  async joinByToken(userId: string, token: string): Promise<HouseholdMembership> {
    try {
      const result = await this.inviteLinkRepo.consumeAndJoin(token, userId);
      const membership = await this.repo.findMembership(userId, result.householdId);
      this.auditService.log({ action: 'member.joined', userId, householdId: result.householdId });
      return membership!;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg === 'INVITE_NOT_FOUND') throw new NotFoundException('Einladungslink nicht gefunden');
      if (msg === 'INVITE_USED') throw new GoneException('Einladungslink wurde bereits verwendet');
      if (msg === 'INVITE_EXPIRED') throw new GoneException('Einladungslink ist abgelaufen');
      if (msg === 'ALREADY_MEMBER') throw new BadRequestException('Du bist bereits Mitglied dieses Haushalts');
      throw err;
    }
  }

  // ─── Household Lifecycle ─────────────────────────────────────────────────

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
