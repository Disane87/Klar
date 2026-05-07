import { Injectable } from '@nestjs/common';
import type { Prisma, Transaction, TransactionSplit, Visibility } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type TransactionWithSplits = Transaction & { splits: TransactionSplit[] };

export interface CreateTransactionData {
  householdId: string;
  createdByUserId: string;
  amountCents: number;
  plannedAmountCents?: number | null;
  isPlanned?: boolean;
  categoryId: string;
  projectId?: string | null;
  date: Date;
  description?: string | null;
  visibility: Visibility;
  recurringTransactionId?: string | null;
  color?: string | null;
  icon?: string | null;
}

export interface UpdateTransactionData {
  amountCents?: number;
  plannedAmountCents?: number | null;
  isPlanned?: boolean;
  categoryId?: string;
  projectId?: string | null;
  date?: Date;
  description?: string | null;
  visibility?: Visibility;
  recurringTransactionId?: string | null;
  color?: string | null;
  icon?: string | null;
}

export interface FindAllOpts {
  categoryId?: string;
  projectId?: string;
  month?: string; // 'YYYY-MM'
  userId?: string;
  isPlanned?: boolean;
}

@Injectable()
export class TransactionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Single source of truth: every find always pulls splits in sortOrder. */
  private readonly includeSplits = {
    splits: { orderBy: { sortOrder: 'asc' } },
  } satisfies Prisma.TransactionInclude;

  findAll(householdId: string, opts: FindAllOpts = {}): Promise<TransactionWithSplits[]> {
    const visibilityFilter = opts.userId
      ? {
          OR: [
            { visibility: 'SHARED' as Visibility },
            { visibility: 'PRIVATE' as Visibility, createdByUserId: opts.userId },
          ],
        }
      : {};

    const dateFilter: { gte?: Date; lt?: Date } = {};
    if (opts.month) {
      const [year, month] = opts.month.split('-').map(Number);
      dateFilter.gte = new Date(Date.UTC(year, month - 1, 1));
      // First day of next month
      const nextMonth = month === 12 ? 1 : month + 1;
      const nextYear = month === 12 ? year + 1 : year;
      dateFilter.lt = new Date(Date.UTC(nextYear, nextMonth - 1, 1));
    }

    return this.prisma.transaction.findMany({
      where: {
        householdId,
        ...(opts.categoryId ? { categoryId: opts.categoryId } : {}),
        ...(opts.projectId ? { projectId: opts.projectId } : {}),
        ...(opts.month ? { date: dateFilter } : {}),
        ...(opts.isPlanned !== undefined ? { isPlanned: opts.isPlanned } : {}),
        ...visibilityFilter,
      },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      include: this.includeSplits,
    });
  }

  findById(id: string, householdId: string): Promise<TransactionWithSplits | null> {
    return this.prisma.transaction.findFirst({
      where: { id, householdId },
      include: this.includeSplits,
    });
  }

  create(data: CreateTransactionData): Promise<TransactionWithSplits> {
    return this.prisma.transaction.create({ data, include: this.includeSplits });
  }

  update(id: string, data: UpdateTransactionData): Promise<TransactionWithSplits> {
    return this.prisma.transaction.update({ where: { id }, data, include: this.includeSplits });
  }

  delete(id: string): Promise<Transaction> {
    return this.prisma.transaction.delete({ where: { id } });
  }

  /**
   * Replaces ALL splits for a transaction in a single transaction so the
   * sum-must-equal-amount invariant cannot half-apply. Pass an empty
   * array to clear all splits.
   */
  async replaceSplits(
    transactionId: string,
    splits: Array<{ label: string; amountCents: number; sortOrder?: number; categoryId?: string | null; note?: string | null }>,
  ): Promise<void> {
    await this.prisma.$transaction(async tx => {
      await tx.transactionSplit.deleteMany({ where: { transactionId } });
      if (splits.length > 0) {
        await tx.transactionSplit.createMany({
          data: splits.map((s, idx) => ({
            transactionId,
            label: s.label,
            amountCents: s.amountCents,
            sortOrder: s.sortOrder ?? idx,
            categoryId: s.categoryId ?? null,
            note: s.note ?? null,
          })),
        });
      }
    });
  }

  /** Find every transaction matching the given ids that belongs to the household. */
  findManyByIds(ids: string[], householdId: string): Promise<Transaction[]> {
    if (ids.length === 0) return Promise.resolve([]);
    return this.prisma.transaction.findMany({
      where: { id: { in: ids }, householdId },
    });
  }

  /** Bulk update categoryId for transactions belonging to the household. */
  bulkUpdateCategory(
    ids: string[],
    householdId: string,
    categoryId: string,
  ): Promise<{ count: number }> {
    if (ids.length === 0) return Promise.resolve({ count: 0 });
    return this.prisma.transaction.updateMany({
      where: { id: { in: ids }, householdId },
      data: { categoryId },
    });
  }

  /** Bulk delete transactions belonging to the household. */
  bulkDelete(ids: string[], householdId: string): Promise<{ count: number }> {
    if (ids.length === 0) return Promise.resolve({ count: 0 });
    return this.prisma.transaction.deleteMany({
      where: { id: { in: ids }, householdId },
    });
  }
}
