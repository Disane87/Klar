import { Injectable } from '@nestjs/common';
import type { RecurringTransaction, RecurringFrequency, Visibility } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateRecurringTransactionData {
  householdId: string;
  createdByUserId: string;
  name: string;
  amountCents: number;
  categoryId: string;
  projectId?: string | null;
  frequency: RecurringFrequency;
  customDays?: number | null;
  dayOfMonth?: number | null;
  startDate: Date;
  endDate?: Date | null;
  visibility: Visibility;
  isVariable: boolean;
  note?: string | null;
  isActive: boolean;
}

export interface UpdateRecurringTransactionData {
  name?: string;
  amountCents?: number;
  categoryId?: string;
  projectId?: string | null;
  frequency?: RecurringFrequency;
  customDays?: number | null;
  dayOfMonth?: number | null;
  startDate?: Date;
  endDate?: Date | null;
  visibility?: Visibility;
  isVariable?: boolean;
  note?: string | null;
}

export interface FindAllOpts {
  categoryId?: string;
  projectId?: string;
  isActive?: boolean;
  userId?: string;
}

@Injectable()
export class RecurringTransactionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll(householdId: string, opts: FindAllOpts = {}): Promise<RecurringTransaction[]> {
    const visibilityFilter = opts.userId
      ? {
          OR: [
            { visibility: 'SHARED' as Visibility },
            { visibility: 'PRIVATE' as Visibility, createdByUserId: opts.userId },
          ],
        }
      : {};

    return this.prisma.recurringTransaction.findMany({
      where: {
        householdId,
        ...(opts.categoryId ? { categoryId: opts.categoryId } : {}),
        ...(opts.projectId ? { projectId: opts.projectId } : {}),
        ...(opts.isActive !== undefined ? { isActive: opts.isActive } : {}),
        ...visibilityFilter,
      },
      orderBy: [{ createdAt: 'asc' }],
    });
  }

  findById(id: string, householdId: string): Promise<RecurringTransaction | null> {
    return this.prisma.recurringTransaction.findFirst({ where: { id, householdId } });
  }

  create(data: CreateRecurringTransactionData): Promise<RecurringTransaction> {
    return this.prisma.recurringTransaction.create({ data });
  }

  update(id: string, data: UpdateRecurringTransactionData): Promise<RecurringTransaction> {
    return this.prisma.recurringTransaction.update({ where: { id }, data });
  }

  delete(id: string): Promise<RecurringTransaction> {
    return this.prisma.recurringTransaction.delete({ where: { id } });
  }

  setActive(id: string, isActive: boolean): Promise<RecurringTransaction> {
    return this.prisma.recurringTransaction.update({ where: { id }, data: { isActive } });
  }
}
