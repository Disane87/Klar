import { Injectable } from '@nestjs/common';
import type {
  CsvImport,
  RecurringTransaction,
  RecurringFrequency,
  Visibility,
  Transaction,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateTransactionFromImport {
  householdId: string;
  createdByUserId: string;
  amountCents: number;
  categoryId: string;
  projectId: string | null;
  date: Date;
  description: string | null;
  visibility: Visibility;
  externalRef: string | null;
  externalHash: string;
  counterparty: string | null;
  sourceImportId: string;
}

export interface CreateRecurringFromImport {
  householdId: string;
  createdByUserId: string;
  name: string;
  amountCents: number;
  categoryId: string;
  frequency: RecurringFrequency;
  dayOfMonth: number | null;
  startDate: Date;
  visibility: Visibility;
}

@Injectable()
export class CsvImportRepository {
  constructor(private readonly prisma: PrismaService) {}

  createCsvImport(data: {
    householdId: string;
    createdByUserId: string;
    filename: string;
    rowCount: number;
  }): Promise<CsvImport> {
    return this.prisma.csvImport.create({
      data: {
        householdId: data.householdId,
        createdByUserId: data.createdByUserId,
        filename: data.filename,
        rowCount: data.rowCount,
      },
    });
  }

  finalizeCsvImport(
    id: string,
    counters: {
      importedCount: number;
      skippedDuplicates: number;
      skippedFixed: number;
      createdRecurrings: number;
    },
  ): Promise<CsvImport> {
    return this.prisma.csvImport.update({ where: { id }, data: counters });
  }

  async loadExistingRefs(householdId: string, refs: string[]): Promise<string[]> {
    if (refs.length === 0) return [];
    const rows = await this.prisma.transaction.findMany({
      where: { householdId, externalRef: { in: refs } },
      select: { externalRef: true },
    });
    return rows.map(r => r.externalRef!).filter(Boolean);
  }

  async loadExistingHashes(householdId: string, hashes: string[]): Promise<string[]> {
    if (hashes.length === 0) return [];
    const rows = await this.prisma.transaction.findMany({
      where: { householdId, externalHash: { in: hashes } },
      select: { externalHash: true },
    });
    return rows.map(r => r.externalHash!).filter(Boolean);
  }

  loadActiveRecurrings(householdId: string): Promise<RecurringTransaction[]> {
    return this.prisma.recurringTransaction.findMany({ where: { householdId, isActive: true } });
  }

  loadRecentTransactions(
    householdId: string,
    sinceISO: string,
  ): Promise<{ counterparty: string | null; date: Date; amountCents: number }[]> {
    return this.prisma.transaction.findMany({
      where: {
        householdId,
        date: { gte: new Date(`${sinceISO}T00:00:00Z`) },
        counterparty: { not: null },
      },
      select: { counterparty: true, date: true, amountCents: true },
    });
  }

  loadLearnings(
    householdId: string,
  ): Promise<{ counterpartyKey: string; categoryId: string }[]> {
    return this.prisma.importLearning.findMany({
      where: { householdId },
      select: { counterpartyKey: true, categoryId: true },
    });
  }

  async upsertLearning(householdId: string, counterpartyKey: string, categoryId: string): Promise<void> {
    await this.prisma.importLearning.upsert({
      where: { householdId_counterpartyKey: { householdId, counterpartyKey } },
      create: { householdId, counterpartyKey, categoryId },
      update: { categoryId, hitCount: { increment: 1 }, lastUsedAt: new Date() },
    });
  }

  createTransaction(data: CreateTransactionFromImport): Promise<Transaction> {
    return this.prisma.transaction.create({ data });
  }

  createRecurring(data: CreateRecurringFromImport): Promise<RecurringTransaction> {
    return this.prisma.recurringTransaction.create({ data });
  }

  assertCategoryInHousehold(householdId: string, categoryId: string) {
    return this.prisma.category.findFirst({
      where: { id: categoryId, householdId },
      select: { id: true },
    });
  }

  assertProjectInHousehold(householdId: string, projectId: string) {
    return this.prisma.project.findFirst({
      where: { id: projectId, householdId },
      select: { id: true },
    });
  }
}
