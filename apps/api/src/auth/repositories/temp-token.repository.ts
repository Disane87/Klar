import { Injectable } from '@nestjs/common';
import type { TempToken } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

interface CreateTempTokenData {
  userId: string;
  token: string;
  expiresAt: Date;
  purpose: string;
}

@Injectable()
export class TempTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateTempTokenData): Promise<TempToken> {
    return this.prisma.tempToken.create({ data });
  }

  findByToken(token: string): Promise<TempToken | null> {
    return this.prisma.tempToken.findUnique({ where: { token } });
  }

  async markUsed(id: string): Promise<void> {
    await this.prisma.tempToken.update({
      where: { id },
      data: { usedAt: new Date() },
    });
  }

  async deleteExpired(): Promise<void> {
    await this.prisma.tempToken.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
  }
}