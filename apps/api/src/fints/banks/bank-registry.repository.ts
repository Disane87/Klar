import { Injectable } from '@nestjs/common';
import type { BlzRegistry, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { BankRecord } from './bank-record';

@Injectable()
export class BankRegistryRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Latest snapshot, or null if none has ever been persisted. */
  findLatest(): Promise<BlzRegistry | null> {
    return this.prisma.blzRegistry.findFirst({
      orderBy: { fetchedAt: 'desc' },
    });
  }

  /**
   * Replace-by-insert: persists a fresh snapshot, then deletes older
   * rows in a single transaction so the table never holds more than
   * one logical "current" snapshot. We keep historical change-counts
   * via AuditLog rather than retaining old rows.
   */
  async replace(input: {
    sourceUrl: string;
    sourceCommit?: string;
    contentHash: string;
    records: BankRecord[];
  }): Promise<BlzRegistry> {
    return this.prisma.$transaction(async tx => {
      const created = await tx.blzRegistry.create({
        data: {
          sourceUrl: input.sourceUrl,
          sourceCommit: input.sourceCommit ?? null,
          contentHash: input.contentHash,
          recordCount: input.records.length,
          banks: input.records as unknown as Prisma.InputJsonValue,
        },
      });
      await tx.blzRegistry.deleteMany({ where: { id: { not: created.id } } });
      return created;
    });
  }

  /** Updates fetchedAt without writing a new row — used on 304 / unchanged. */
  touch(id: number): Promise<BlzRegistry> {
    return this.prisma.blzRegistry.update({
      where: { id },
      data: { fetchedAt: new Date() },
    });
  }
}
