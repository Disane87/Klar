import { Injectable } from '@nestjs/common';
import type { Category } from '@prisma/client';
import { CategoryType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateCategoryData {
  householdId: string;
  name: string;
  type: CategoryType;
  color: string;
  icon?: string | null;
  sortOrder?: number;
  isDefault?: boolean;
}

export interface UpdateCategoryData {
  name?: string;
  color?: string;
  icon?: string | null;
  sortOrder?: number;
  isArchived?: boolean;
}

@Injectable()
export class CategoriesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll(
    householdId: string,
    opts: { type?: CategoryType; includeArchived?: boolean } = {},
  ): Promise<Category[]> {
    return this.prisma.category.findMany({
      where: {
        householdId,
        ...(opts.type ? { type: opts.type } : {}),
        ...(!opts.includeArchived ? { isArchived: false } : {}),
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  findById(id: string, householdId: string): Promise<Category | null> {
    return this.prisma.category.findFirst({ where: { id, householdId } });
  }

  create(data: CreateCategoryData): Promise<Category> {
    return this.prisma.category.create({ data });
  }

  createMany(data: CreateCategoryData[]): Promise<{ count: number }> {
    return this.prisma.category.createMany({ data });
  }

  update(id: string, householdId: string, data: UpdateCategoryData): Promise<Category> {
    return this.prisma.category.update({ where: { id }, data });
  }

  async hasTransactions(id: string): Promise<boolean> {
    const count = await this.prisma.transaction.count({ where: { categoryId: id } });
    const rCount = await this.prisma.recurringTransaction.count({ where: { categoryId: id } });
    return count + rCount > 0;
  }

  delete(id: string): Promise<Category> {
    return this.prisma.category.delete({ where: { id } });
  }
}
