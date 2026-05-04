import { Injectable } from '@nestjs/common';
import type { Category, Project, Transaction, RecurringTransaction } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface ExportOpts {
  include?: ('transactions' | 'recurringTransactions')[];
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
}

function toUtcDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

@Injectable()
export class DataTransferRepository {
  constructor(private readonly prisma: PrismaService) {}

  findTransactionsForExport(
    householdId: string,
    opts: ExportOpts,
  ): Promise<(Transaction & { category: Category; project: Project | null })[]> {
    const dateWhere: Record<string, Date> = {};
    if (opts.startDate) dateWhere['gte'] = toUtcDate(opts.startDate);
    if (opts.endDate) dateWhere['lte'] = toUtcDate(opts.endDate);

    return this.prisma.transaction.findMany({
      where: {
        householdId,
        ...(Object.keys(dateWhere).length ? { date: dateWhere } : {}),
      },
      include: { category: true, project: true },
      orderBy: { date: 'asc' },
    }) as Promise<(Transaction & { category: Category; project: Project | null })[]>;
  }

  findRecurringTransactionsForExport(
    householdId: string,
  ): Promise<(RecurringTransaction & { category: Category; project: Project | null })[]> {
    return this.prisma.recurringTransaction.findMany({
      where: { householdId },
      include: { category: true, project: true },
      orderBy: { createdAt: 'asc' },
    }) as Promise<(RecurringTransaction & { category: Category; project: Project | null })[]>;
  }

  findCategoriesByNames(
    householdId: string,
    entries: { name: string; type: string }[],
  ): Promise<Category[]> {
    if (!entries.length) return Promise.resolve([]);
    return this.prisma.category.findMany({
      where: {
        householdId,
        OR: entries.map(e => ({
          name: { equals: e.name, mode: 'insensitive' as const },
          type: e.type as Category['type'],
        })),
      },
    });
  }

  findProjectsByNames(householdId: string, names: string[]): Promise<Project[]> {
    if (!names.length) return Promise.resolve([]);
    return this.prisma.project.findMany({
      where: {
        householdId,
        name: { in: names, mode: 'insensitive' },
      },
    });
  }

  findAllCategories(householdId: string): Promise<Category[]> {
    return this.prisma.category.findMany({
      where: { householdId, isArchived: false },
      orderBy: { name: 'asc' },
    });
  }

  findAllProjects(householdId: string): Promise<Project[]> {
    return this.prisma.project.findMany({
      where: { householdId },
      orderBy: { name: 'asc' },
    });
  }

  findCategoryById(householdId: string, id: string): Promise<Category | null> {
    return this.prisma.category.findFirst({ where: { id, householdId } });
  }

  findProjectById(householdId: string, id: string): Promise<Project | null> {
    return this.prisma.project.findFirst({ where: { id, householdId } });
  }

  createTransaction(data: {
    householdId: string;
    createdByUserId: string;
    amountCents: number;
    categoryId: string;
    projectId: string | null;
    date: Date;
    description: string | null;
    visibility: 'SHARED' | 'PRIVATE';
  }): Promise<Transaction> {
    return this.prisma.transaction.create({ data });
  }

  createRecurringTransaction(data: {
    householdId: string;
    createdByUserId: string;
    name: string;
    amountCents: number;
    categoryId: string;
    projectId: string | null;
    frequency: RecurringTransaction['frequency'];
    customDays: number | null;
    dayOfMonth: number | null;
    startDate: Date;
    endDate: Date | null;
    visibility: 'SHARED' | 'PRIVATE';
    isVariable: boolean;
    isActive: boolean;
    note: string | null;
    color: string | null;
    icon: string | null;
  }): Promise<RecurringTransaction> {
    return this.prisma.recurringTransaction.create({ data });
  }
}
