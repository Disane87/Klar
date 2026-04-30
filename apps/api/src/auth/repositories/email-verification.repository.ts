import { Injectable } from '@nestjs/common';
import type { EmailVerification } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

interface CreateEmailVerificationData {
  userId: string;
  token: string;
  expiresAt: Date;
}

@Injectable()
export class EmailVerificationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateEmailVerificationData): Promise<void> {
    await this.prisma.emailVerification.create({ data });
  }

  findByToken(token: string): Promise<EmailVerification | null> {
    return this.prisma.emailVerification.findUnique({ where: { token } });
  }

  async deleteByUserId(userId: string): Promise<void> {
    await this.prisma.emailVerification.deleteMany({ where: { userId } });
  }

  async deleteByToken(token: string): Promise<void> {
    await this.prisma.emailVerification.deleteMany({ where: { token } });
  }

  async deleteExpired(): Promise<void> {
    await this.prisma.emailVerification.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
  }
}
