import { Injectable } from '@nestjs/common';
import type { Budget } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface FindAllBudgetOpts {
  month?: string;    // 'YYYY-MM' — normalized to 'YYYY-MM-01' internally
  categoryId?: string;
}

@Injectable()
export class BudgetsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll(householdId: string, opts: FindAllBudgetOpts = {}): Promise<Budget[]> {
    const where: {
      householdId: string;
      categoryId?: string;
      month?: Date;
    } = { householdId };

    if (opts.categoryId) where.categoryId = opts.categoryId;
    if (opts.month) where.month = normalizeMonthToDate(opts.month);

    return this.prisma.budget.findMany({
      where,
      orderBy: [{ month: 'desc' }],
    });
  }

  findById(id: string, householdId: string): Promise<Budget | null> {
    return this.prisma.budget.findFirst({ where: { id, householdId } });
  }

  upsert(
    householdId: string,
    categoryId: string,
    month: string,
    amountCents: number,
  ): Promise<Budget> {
    const monthDate = normalizeMonthToDate(month);
    return this.prisma.budget.upsert({
      where: {
        householdId_categoryId_month: {
          householdId,
          categoryId,
          month: monthDate,
        },
      },
      create: {
        householdId,
        categoryId,
        month: monthDate,
        amountCents,
      },
      update: {
        amountCents,
      },
    });
  }

  delete(id: string, householdId: string): Promise<Budget> {
    // findFirst is done in service before delete — here we trust the id is valid
    return this.prisma.budget.delete({ where: { id } });
  }
}

/** Converts 'YYYY-MM' to a Date representing the first day of that month (UTC) */
function normalizeMonthToDate(month: string): Date {
  // Accept both 'YYYY-MM' and 'YYYY-MM-01'
  const [year, mon] = month.split('-').map(Number);
  return new Date(Date.UTC(year, mon - 1, 1));
}
