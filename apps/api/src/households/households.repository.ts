import { Injectable } from '@nestjs/common';
import type { Household, HouseholdMembership } from '@prisma/client';
import { HouseholdRole, MailTemplateType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

interface CreateWithOwnerData {
  name: string;
  ownerId: string;
}

@Injectable()
export class HouseholdsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createWithOwner(data: CreateWithOwnerData): Promise<Household> {
    return this.prisma.$transaction(async (tx) => {
      const household = await tx.household.create({
        data: { name: data.name },
      });
      await tx.householdMembership.create({
        data: {
          householdId: household.id,
          userId: data.ownerId,
          role: HouseholdRole.OWNER,
        },
      });
      return household;
    });
  }

  findById(id: string): Promise<Household | null> {
    return this.prisma.household.findUnique({ where: { id } });
  }

  findMembership(userId: string, householdId: string): Promise<HouseholdMembership | null> {
    return this.prisma.householdMembership.findUnique({
      where: { userId_householdId: { userId, householdId } },
    });
  }

  findCallerWithUser(userId: string, householdId: string): Promise<(HouseholdMembership & { user: { displayName: string } }) | null> {
    return this.prisma.householdMembership.findUnique({
      where: { userId_householdId: { userId, householdId } },
      include: { user: { select: { displayName: true } } },
    });
  }

  findMembershipsByUser(userId: string): Promise<(HouseholdMembership & { household: Household })[]> {
    return this.prisma.householdMembership.findMany({
      where: { userId },
      include: { household: true },
      orderBy: { joinedAt: 'asc' },
    });
  }

  findMembershipsByHousehold(
    householdId: string,
  ): Promise<(HouseholdMembership & { user: { id: string; displayName: string; email: string; avatarUrl: string | null } })[]> {
    return this.prisma.householdMembership.findMany({
      where: { householdId },
      include: { user: { select: { id: true, displayName: true, email: true, avatarUrl: true } } },
      orderBy: { joinedAt: 'asc' },
    });
  }

  async addMember(userId: string, householdId: string, role = HouseholdRole.MEMBER): Promise<HouseholdMembership> {
    return this.prisma.householdMembership.create({
      data: { userId, householdId, role },
    });
  }

  async removeMember(userId: string, householdId: string): Promise<void> {
    await this.prisma.householdMembership.delete({
      where: { userId_householdId: { userId, householdId } },
    });
  }

  updateName(householdId: string, name: string): Promise<Household> {
    return this.prisma.household.update({
      where: { id: householdId },
      data: { name },
    });
  }

  async countOwnerMemberships(userId: string): Promise<number> {
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

  async countMembers(householdId: string): Promise<number> {
    return this.prisma.householdMembership.count({
      where: { householdId },
    });
  }

  async deleteHousehold(householdId: string): Promise<void> {
    await this.prisma.householdMembership.deleteMany({ where: { householdId } });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (this.prisma as any).invitationLink.deleteMany({ where: { householdId } });
    await this.prisma.household.delete({ where: { id: householdId } });
  }

  async seedDefaultTemplates(householdId: string): Promise<void> {
    await this.prisma.householdMailTemplate.upsert({
      where: { householdId_templateType: { householdId, templateType: MailTemplateType.INVITE } },
      create: {
        householdId,
        templateType: MailTemplateType.INVITE,
        name: 'Einladungslink',
        subject: '{{inviterName}} lädt dich zu "{{householdName}}" ein — Klar',
        body: '<p>Hallo,</p><p><strong>{{inviterName}}</strong> lädt dich ein, dem Haushalt <strong>{{householdName}}</strong> beizutreten.</p><p><a href="{{inviteUrl}}">Einladung annehmen</a></p>',
        isActive: true,
      },
      update: {},
    });
  }
}
