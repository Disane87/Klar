import { Injectable } from '@nestjs/common';
import type { FintsConnection, FintsConnectionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class FintsConnectionRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<FintsConnection | null> {
    return this.prisma.fintsConnection.findUnique({ where: { id } });
  }

  findAllActive(): Promise<FintsConnection[]> {
    return this.prisma.fintsConnection.findMany({
      where: { status: 'ACTIVE' },
    });
  }

  /**
   * Connections whose SCA window expires within the next `withinDays`
   * days (and not already past). Used by the reauth watcher's 7-day
   * pre-warning pass.
   */
  findExpiringWithin(withinDays: number, now = new Date()): Promise<FintsConnection[]> {
    const upper = new Date(now.getTime() + withinDays * 86_400_000);
    return this.prisma.fintsConnection.findMany({
      where: {
        status: 'ACTIVE',
        scaExpiresAt: { gte: now, lte: upper },
      },
    });
  }

  /**
   * Connections whose SCA window has already expired but are still flagged
   * ACTIVE — the watcher flips them to REAUTH_REQUIRED on the next pass.
   */
  findExpired(now = new Date()): Promise<FintsConnection[]> {
    return this.prisma.fintsConnection.findMany({
      where: {
        status: 'ACTIVE',
        scaExpiresAt: { lt: now },
      },
    });
  }

  setStatus(id: string, status: FintsConnectionStatus): Promise<FintsConnection> {
    return this.prisma.fintsConnection.update({
      where: { id },
      data: { status },
    });
  }
}
