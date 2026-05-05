import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';
import { HouseholdRole } from '@prisma/client';
import type { InvitationLink } from '@prisma/client';

interface CreateInviteLinkData {
  householdId: string;
  createdByUserId: string;
  email?: string;
  expiresAt?: Date;
}

@Injectable()
export class InvitationLinkRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateInviteLinkData): Promise<InvitationLink> {
    const token = crypto.randomBytes(32).toString('base64url');
    return this.prisma.invitationLink.create({
      data: {
        householdId: data.householdId,
        token,
        email: data.email ?? null,
        createdByUserId: data.createdByUserId,
        expiresAt: data.expiresAt ?? null,
      },
    });
  }

  findByHousehold(householdId: string): Promise<InvitationLink[]> {
    return this.prisma.invitationLink.findMany({
      where: { householdId },
      orderBy: { createdAt: 'desc' },
    });
  }

  findByToken(token: string): Promise<InvitationLink | null> {
    return this.prisma.invitationLink.findUnique({ where: { token } });
  }

  async updateEmail(id: string, email: string): Promise<void> {
    await this.prisma.invitationLink.update({ where: { id }, data: { email } });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.invitationLink.delete({ where: { id } });
  }

  async deleteByHousehold(householdId: string): Promise<void> {
    await this.prisma.invitationLink.deleteMany({ where: { householdId } });
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
        data: { userId, householdId: invite.householdId, role: HouseholdRole.MEMBER },
      });

      await tx.invitationLink.update({
        where: { token },
        data: { usedAt: new Date(), usedByUserId: userId },
      });

      return { householdId: invite.householdId };
    });
  }
}
