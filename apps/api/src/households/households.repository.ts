import { Injectable } from '@nestjs/common';
import type { Household, HouseholdMembership } from '@prisma/client';
import { HouseholdRole } from '@prisma/client';
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

  findMembershipsByUser(userId: string): Promise<(HouseholdMembership & { household: Household })[]> {
    return this.prisma.householdMembership.findMany({
      where: { userId },
      include: { household: true },
      orderBy: { joinedAt: 'asc' },
    });
  }

  findMembershipsByHousehold(
    householdId: string,
  ): Promise<(HouseholdMembership & { user: { id: string; displayName: string; email: string } })[]> {
    return this.prisma.householdMembership.findMany({
      where: { householdId },
      include: { user: { select: { id: true, displayName: true, email: true } } },
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
}
