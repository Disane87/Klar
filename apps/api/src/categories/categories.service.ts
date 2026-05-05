import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import type { Category } from '@prisma/client';
import { CategoryType } from '@prisma/client';
import type { RequestContext } from '../common/types/request-context.type';
import { CategoriesRepository, type CreateCategoryData } from './categories.repository';

export { CategoryType };

export interface CreateCategoryInput {
  name: string;
  type: CategoryType;
  color: string;
  icon?: string | null;
  sortOrder?: number;
}

export interface UpdateCategoryInput {
  name?: string;
  color?: string;
  icon?: string | null;
  sortOrder?: number;
  isArchived?: boolean;
}

// Default categories seeded for every new household
const DEFAULT_CATEGORIES: Array<Omit<CreateCategoryData, 'householdId'>> = [
  // Fixed income
  { name: 'Festgehalt', type: CategoryType.FIXED_INCOME, color: '#22c55e', icon: 'briefcase', sortOrder: 0, isDefault: true },
  // Variable income
  { name: 'Variables Einkommen', type: CategoryType.VARIABLE_INCOME, color: '#4ade80', icon: 'trending-up', sortOrder: 1, isDefault: true },
  // Fixed expenses (Miete, Versicherung, Abos)
  { name: 'Wohnen', type: CategoryType.FIXED_EXPENSE, color: '#60a5fa', icon: 'home', sortOrder: 10, isDefault: true },
  { name: 'Versicherungen', type: CategoryType.FIXED_EXPENSE, color: '#f472b6', icon: 'shield', sortOrder: 11, isDefault: true },
  // Variable expenses (alltägliche Ausgaben)
  { name: 'Lebensmittel', type: CategoryType.VARIABLE_EXPENSE, color: '#fb923c', icon: 'shopping-cart', sortOrder: 20, isDefault: true },
  { name: 'Mobilität', type: CategoryType.VARIABLE_EXPENSE, color: '#a78bfa', icon: 'car', sortOrder: 21, isDefault: true },
  { name: 'Gesundheit', type: CategoryType.VARIABLE_EXPENSE, color: '#34d399', icon: 'heart', sortOrder: 22, isDefault: true },
  { name: 'Freizeit', type: CategoryType.VARIABLE_EXPENSE, color: '#fbbf24', icon: 'star', sortOrder: 23, isDefault: true },
  { name: 'Kleidung', type: CategoryType.VARIABLE_EXPENSE, color: '#f87171', icon: 'tag', sortOrder: 24, isDefault: true },
  { name: 'Sonstiges', type: CategoryType.VARIABLE_EXPENSE, color: '#94a3b8', icon: 'more-horizontal', sortOrder: 99, isDefault: true },
  // Savings / Vermögensaufbau (kein klassischer Expense)
  { name: 'Sparen', type: CategoryType.SAVINGS, color: '#0ea5e9', icon: 'piggy-bank', sortOrder: 30, isDefault: true },
];

@Injectable()
export class CategoriesService {
  constructor(private readonly repo: CategoriesRepository) {}

  list(
    ctx: RequestContext,
    opts: { type?: CategoryType; includeArchived?: boolean } = {},
  ): Promise<Category[]> {
    return this.repo.findAll(ctx.householdId, opts);
  }

  async create(ctx: RequestContext, input: CreateCategoryInput): Promise<Category> {
    return this.repo.create({
      householdId: ctx.householdId,
      name: input.name.trim(),
      type: input.type,
      color: input.color,
      icon: input.icon ?? null,
      sortOrder: input.sortOrder ?? 0,
      isDefault: false,
    });
  }

  async update(ctx: RequestContext, id: string, input: UpdateCategoryInput): Promise<Category> {
    const existing = await this.repo.findById(id, ctx.householdId);
    if (!existing) throw new NotFoundException(`Kategorie ${id} nicht gefunden`);

    return this.repo.update(id, ctx.householdId, {
      ...input,
      ...(input.name ? { name: input.name.trim() } : {}),
    });
  }

  async remove(ctx: RequestContext, id: string): Promise<void> {
    const existing = await this.repo.findById(id, ctx.householdId);
    if (!existing) throw new NotFoundException(`Kategorie ${id} nicht gefunden`);

    const hasTransactions = await this.repo.hasTransactions(id);
    if (hasTransactions) {
      // Soft delete: archive instead of hard delete to preserve data integrity
      await this.repo.update(id, ctx.householdId, { isArchived: true });
    } else {
      await this.repo.delete(id);
    }
  }

  async seedDefaults(householdId: string): Promise<void> {
    await this.repo.createMany(
      DEFAULT_CATEGORIES.map(c => ({ ...c, householdId })),
    );
  }

  toResponse(c: Category) {
    return {
      id: c.id,
      householdId: c.householdId,
      name: c.name,
      type: c.type,
      color: c.color,
      icon: c.icon,
      isArchived: c.isArchived,
      sortOrder: c.sortOrder,
      isDefault: c.isDefault,
      createdAt: c.createdAt.toISOString(),
    };
  }
}
