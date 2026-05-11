import { Injectable } from '@nestjs/common';
import type { RecurringTransaction, RecurringFrequency, Visibility } from '@prisma/client';
import { Prisma } from '@prisma/client';
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
  color?: string | null;
  icon?: string | null;
  isActive: boolean;
  payrollInput?: Prisma.InputJsonValue | null;
  splits?: { label: string; amountCents: number; sortOrder?: number; note?: string | null }[];
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
  color?: string | null;
  icon?: string | null;
  payrollInput?: Prisma.InputJsonValue | null;
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
    const { payrollInput, splits, ...rest } = data;
    return this.prisma.recurringTransaction.create({
      data: {
        ...rest,
        ...(payrollInput === undefined
          ? {}
          : { payrollInput: payrollInput === null ? Prisma.JsonNull : payrollInput }),
        ...(splits && splits.length > 0
          ? {
              splits: {
                create: splits.map((s, i) => ({
                  label:       s.label,
                  amountCents: s.amountCents,
                  sortOrder:   s.sortOrder ?? i,
                  note:        s.note ?? null,
                })),
              },
            }
          : {}),
      },
    });
  }

  update(id: string, data: UpdateRecurringTransactionData): Promise<RecurringTransaction> {
    const { payrollInput, ...rest } = data;
    return this.prisma.recurringTransaction.update({
      where: { id },
      data: {
        ...rest,
        ...(payrollInput === undefined
          ? {}
          : { payrollInput: payrollInput === null ? Prisma.JsonNull : payrollInput }),
      },
    });
  }

  delete(id: string): Promise<RecurringTransaction> {
    return this.prisma.recurringTransaction.delete({ where: { id } });
  }

  setActive(id: string, isActive: boolean): Promise<RecurringTransaction> {
    return this.prisma.recurringTransaction.update({ where: { id }, data: { isActive } });
  }

  /** Bulk setActive for recurring templates belonging to the household. */
  bulkSetActive(
    ids: string[],
    householdId: string,
    isActive: boolean,
  ): Promise<{ count: number }> {
    if (ids.length === 0) return Promise.resolve({ count: 0 });
    return this.prisma.recurringTransaction.updateMany({
      where: { id: { in: ids }, householdId },
      data: { isActive },
    });
  }

  /** Find every recurring template matching the given ids that belongs to the household. */
  findManyByIds(ids: string[], householdId: string): Promise<RecurringTransaction[]> {
    if (ids.length === 0) return Promise.resolve([]);
    return this.prisma.recurringTransaction.findMany({
      where: { id: { in: ids }, householdId },
    });
  }
}
