import { Injectable } from '@nestjs/common';
import type { Transaction, Visibility } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateTransactionData {
  householdId: string;
  createdByUserId: string;
  amountCents: number;
  categoryId: string;
  projectId?: string | null;
  date: Date;
  description?: string | null;
  visibility: Visibility;
  recurringTransactionId?: string | null;
}

export interface UpdateTransactionData {
  amountCents?: number;
  categoryId?: string;
  projectId?: string | null;
  date?: Date;
  description?: string | null;
  visibility?: Visibility;
  recurringTransactionId?: string | null;
}

export interface FindAllOpts {
  categoryId?: string;
  projectId?: string;
  month?: string; // 'YYYY-MM'
  userId?: string;
}

@Injectable()
export class TransactionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll(householdId: string, opts: FindAllOpts = {}): Promise<Transaction[]> {
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
        ...visibilityFilter,
      },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });
  }

  findById(id: string, householdId: string): Promise<Transaction | null> {
    return this.prisma.transaction.findFirst({ where: { id, householdId } });
  }

  create(data: CreateTransactionData): Promise<Transaction> {
    return this.prisma.transaction.create({ data });
  }

  update(id: string, data: UpdateTransactionData): Promise<Transaction> {
    return this.prisma.transaction.update({ where: { id }, data });
  }

  delete(id: string): Promise<Transaction> {
    return this.prisma.transaction.delete({ where: { id } });
  }
}
