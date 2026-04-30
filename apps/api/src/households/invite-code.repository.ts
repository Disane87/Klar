import { Injectable } from '@nestjs/common';
import type { InviteCode } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';

function generateCode(): string {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

interface CreateInviteData {
  householdId: string;
  createdByUserId: string;
  expiresAt?: Date;
  maxUses?: number;
}

@Injectable()
export class InviteCodeRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateInviteData): Promise<InviteCode> {
    const code = generateCode();
    return this.prisma.inviteCode.create({
      data: {
        householdId: data.householdId,
        code,
        createdByUserId: data.createdByUserId,
        expiresAt: data.expiresAt,
        usesRemaining: data.maxUses ?? null,
      },
    });
  }

  findByCode(code: string): Promise<InviteCode | null> {
    return this.prisma.inviteCode.findUnique({ where: { code } });
  }

  findByHousehold(householdId: string): Promise<InviteCode[]> {
    return this.prisma.inviteCode.findMany({
      where: { householdId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async consumeAndJoin(code: string, userId: string): Promise<{ householdId: string }> {
    return this.prisma.$transaction(async (tx) => {
      const invite = await tx.inviteCode.findUnique({ where: { code } });

      if (!invite) throw new Error('INVITE_NOT_FOUND');
      if (invite.expiresAt && invite.expiresAt < new Date()) throw new Error('INVITE_EXPIRED');
      if (invite.usesRemaining !== null && invite.usesRemaining <= 0) throw new Error('INVITE_EXHAUSTED');

      const existingMembership = await tx.householdMembership.findUnique({
        where: { userId_householdId: { userId, householdId: invite.householdId } },
      });
      if (existingMembership) throw new Error('ALREADY_MEMBER');

      await tx.householdMembership.create({
        data: { userId, householdId: invite.householdId },
      });

      if (invite.usesRemaining !== null) {
        await tx.inviteCode.update({
          where: { code },
          data: { usesRemaining: invite.usesRemaining - 1 },
        });
      }

      return { householdId: invite.householdId };
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.inviteCode.delete({ where: { id } });
  }
}
