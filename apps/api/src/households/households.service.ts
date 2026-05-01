import {
  Injectable,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import type { Household, HouseholdMembership, InviteCode } from '@prisma/client';
import { HouseholdRole } from '@prisma/client';
import type { RequestContext } from '../common/types/request-context.type';
import { HouseholdsRepository } from './households.repository';
import { InviteCodeRepository } from './invite-code.repository';
import { AuditService } from '../audit/audit.service';

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

@Injectable()
export class HouseholdsService {
  constructor(
    private readonly repo: HouseholdsRepository,
    private readonly inviteRepo: InviteCodeRepository,
    private readonly auditService: AuditService,
  ) {}

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

  async createInvite(
    ctx: RequestContext,
    opts: { expiresAt?: Date; maxUses?: number } = {},
  ): Promise<InviteCode> {
    const callerMembership = await this.repo.findMembership(ctx.userId, ctx.householdId);
    if (!callerMembership || callerMembership.role !== HouseholdRole.OWNER) {
      throw new ForbiddenException('Nur der Eigentümer kann Einladungen erstellen');
    }

    const invite = await this.inviteRepo.create({
      householdId: ctx.householdId,
      createdByUserId: ctx.userId,
      expiresAt: opts.expiresAt,
      maxUses: opts.maxUses,
    });

    this.auditService.log({
      action: 'member.invited',
      userId: ctx.userId,
      householdId: ctx.householdId,
      metadata: { inviteCode: invite.code },
    });

    return invite;
  }

  async listInvites(ctx: RequestContext): Promise<InviteCode[]> {
    return this.inviteRepo.findByHousehold(ctx.householdId);
  }

  async deleteInvite(ctx: RequestContext, inviteId: string): Promise<void> {
    const callerMembership = await this.repo.findMembership(ctx.userId, ctx.householdId);
    if (!callerMembership || callerMembership.role !== HouseholdRole.OWNER) {
      throw new ForbiddenException('Nur der Eigentümer kann Einladungen löschen');
    }
    await this.inviteRepo.delete(inviteId);
  }

  async ensureMembership(userId: string, householdId: string): Promise<void> {
    const existing = await this.repo.findMembership(userId, householdId);
    if (!existing) {
      await this.repo.addMember(userId, householdId);
      this.auditService.log({ action: 'member.auto_joined', userId, householdId });
    }
  }

  async joinByCode(userId: string, code: string): Promise<HouseholdMembership> {
    const normalizedCode = code.replace(/-/g, '').toUpperCase();
    try {
      const result = await this.inviteRepo.consumeAndJoin(normalizedCode, userId);
      const membership = await this.repo.findMembership(userId, result.householdId);
      this.auditService.log({
        action: 'member.joined',
        userId,
        householdId: result.householdId,
      });
      return membership!;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg === 'INVITE_NOT_FOUND') throw new NotFoundException('Einladungscode nicht gefunden');
      if (msg === 'INVITE_EXPIRED') throw new BadRequestException('Einladungscode ist abgelaufen');
      if (msg === 'INVITE_EXHAUSTED') throw new BadRequestException('Einladungscode wurde bereits zu oft verwendet');
      if (msg === 'ALREADY_MEMBER') throw new BadRequestException('Du bist bereits Mitglied dieses Haushalts');
      throw err;
    }
  }
}
