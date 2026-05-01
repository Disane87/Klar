import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import type { Budget } from '@prisma/client';
import type { RequestContext } from '../common/types/request-context.type';
import { BudgetsRepository, type FindAllBudgetOpts } from './budgets.repository';

export interface UpsertBudgetInput {
  categoryId: string;
  month: string;      // 'YYYY-MM' format from client
  amountCents: number;
}

export interface ListBudgetOpts {
  month?: string;     // 'YYYY-MM'
  categoryId?: string;
}

@Injectable()
export class BudgetsService {
  constructor(private readonly repo: BudgetsRepository) {}

  list(ctx: RequestContext, opts: ListBudgetOpts = {}): Promise<Budget[]> {
    const repoOpts: FindAllBudgetOpts = {};
    if (opts.month) repoOpts.month = opts.month;
    if (opts.categoryId) repoOpts.categoryId = opts.categoryId;
    return this.repo.findAll(ctx.householdId, repoOpts);
  }

  async upsert(ctx: RequestContext, input: UpsertBudgetInput): Promise<Budget> {
    if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
      throw new BadRequestException('amountCents muss eine positive Ganzzahl sein');
    }
    if (!input.categoryId) {
      throw new BadRequestException('categoryId ist erforderlich');
    }
    if (!input.month) {
      throw new BadRequestException('month ist erforderlich');
    }

    // Normalize month: accept 'YYYY-MM' or 'YYYY-MM-DD', store as 'YYYY-MM-01'
    const normalizedMonth = normalizeMonth(input.month);

    return this.repo.upsert(ctx.householdId, input.categoryId, normalizedMonth, input.amountCents);
  }

  async remove(ctx: RequestContext, id: string): Promise<void> {
    const existing = await this.repo.findById(id, ctx.householdId);
    if (!existing) throw new NotFoundException(`Budget ${id} nicht gefunden`);
    await this.repo.delete(id, ctx.householdId);
  }

  toResponse(b: Budget) {
    return {
      id: b.id,
      householdId: b.householdId,
      categoryId: b.categoryId,
      month: b.month.toISOString().slice(0, 10), // YYYY-MM-01
      amountCents: b.amountCents,
      createdAt: b.createdAt.toISOString(),
      updatedAt: b.updatedAt.toISOString(),
    };
  }
}

/** Normalize 'YYYY-MM' or 'YYYY-MM-DD' to 'YYYY-MM-01' */
function normalizeMonth(month: string): string {
  const parts = month.split('-');
  return `${parts[0]}-${parts[1]}-01`;
}
