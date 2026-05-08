import { Injectable } from '@nestjs/common';
import type { Prisma, Transaction, TransactionKind, TxSource } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateIngestedTransactionData {
  householdId: string;
  accountId: string;
  /** May be null when no household member triggered the import (cron sync). */
  createdByUserId: string | null;
  amountCents: number;
  /**
   * Imported transactions land in a "default" category that the household
   * already owns. Resolution happens upstream in ImportPipelineService.
   */
  categoryId: string;
  date: Date;
  description: string | null;
  counterparty: string | null;
  externalRef: string | null;
  externalHash: string;
  source: TxSource;
  /** FK to CsvImport when source='csv'. */
  sourceImportId?: string | null;
  /** FK to FintsSyncRun when source='fints'. */
  fintsSyncRunId?: string | null;
  /** Set to "now" when source='fints' so the UI locks bank-fields. */
  bankFieldsLockedAt?: Date | null;
  /** Detected transaction kind (e.g. STANDING_ORDER); null when unknown. */
  transactionKind: TransactionKind | null;
}

@Injectable()
export class ImportPipelineRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns the subset of `refs` that already exist on a transaction
   * within the given account. Account scoping mirrors the dedup design
   * (each FinTS account / CSV pot has its own dedup namespace).
   */
  async findExistingRefs(accountId: string, refs: string[]): Promise<string[]> {
    if (refs.length === 0) return [];
    const rows = await this.prisma.transaction.findMany({
      where: { accountId, externalRef: { in: refs } },
      select: { externalRef: true },
    });
    return rows
      .map(r => r.externalRef)
      .filter((v): v is string => v !== null);
  }

  /** Same as {@link findExistingRefs} but for the externalHash dedup column. */
  async findExistingHashes(accountId: string, hashes: string[]): Promise<string[]> {
    if (hashes.length === 0) return [];
    const rows = await this.prisma.transaction.findMany({
      where: { accountId, externalHash: { in: hashes } },
      select: { externalHash: true },
    });
    return rows
      .map(r => r.externalHash)
      .filter((v): v is string => v !== null);
  }

  createTransaction(data: CreateIngestedTransactionData): Promise<Transaction> {
    return this.prisma.transaction.create({
      data: data as unknown as Prisma.TransactionCreateInput,
    });
  }

  /**
   * Looks up the household's first non-archived category for a given
   * sign — used as a sane default for FinTS auto-imports when the
   * learning layer hasn't decided yet. Returning null pushes the caller
   * to fail loudly rather than mis-categorise.
   */
  async findFallbackCategory(
    householdId: string,
    type: 'income' | 'expense',
  ): Promise<string | null> {
    const row = await this.prisma.category.findFirst({
      where: {
        householdId,
        isArchived: false,
        type:
          type === 'income'
            ? { in: ['INCOME', 'VARIABLE_INCOME', 'FIXED_INCOME'] }
            : { in: ['EXPENSE', 'VARIABLE_EXPENSE', 'FIXED_EXPENSE'] },
      },
      orderBy: [{ isDefault: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: { id: true },
    });
    return row?.id ?? null;
  }
}
