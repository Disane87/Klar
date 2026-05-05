import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';
import { HouseholdRole } from '@prisma/client';

// Prisma-Typ für InvitationLink (verwende `any` mit Cast bis Client regeneriert wird)
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (this.prisma as any).invitationLink.create({
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (this.prisma as any).invitationLink.findMany({
      where: { householdId },
      orderBy: { createdAt: 'desc' },
    });
  }

  findByToken(token: string): Promise<InvitationLink | null> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (this.prisma as any).invitationLink.findUnique({ where: { token } });
  }

  async delete(id: string): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (this.prisma as any).invitationLink.delete({ where: { id } });
  }

  async deleteByHousehold(householdId: string): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (this.prisma as any).invitationLink.deleteMany({ where: { householdId } });
  }

  async consumeAndJoin(token: string, userId: string): Promise<{ householdId: string }> {
    return this.prisma.$transaction(async (tx) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const invite = await (tx as any).invitationLink.findUnique({ where: { token } });
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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (tx as any).invitationLink.update({
        where: { token },
        data: { usedAt: new Date(), usedByUserId: userId },
      });

      return { householdId: invite.householdId };
    });
  }
}
