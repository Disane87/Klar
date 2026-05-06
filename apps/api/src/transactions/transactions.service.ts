import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import type { Transaction } from '@prisma/client';
import { Visibility } from '@prisma/client';
import type { RequestContext } from '../common/types/request-context.type';
import {
  TransactionsRepository,
  type FindAllOpts,
  type UpdateTransactionData,
} from './transactions.repository';

export { Visibility };

export interface CreateTransactionInput {
  amountCents: number;
  plannedAmountCents?: number | null;
  isPlanned?: boolean;
  categoryId: string;
  projectId?: string | null;
  date: string; // ISO YYYY-MM-DD
  description?: string | null;
  visibility?: Visibility;
  recurringTransactionId?: string | null;
}

export type UpdateTransactionInput = Partial<CreateTransactionInput>;

export interface ListOpts {
  categoryId?: string;
  projectId?: string;
  month?: string; // 'YYYY-MM'
  isPlanned?: boolean;
}

function parsePlainDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

@Injectable()
export class TransactionsService {
  constructor(private readonly repo: TransactionsRepository) {}

  list(ctx: RequestContext, opts: ListOpts = {}): Promise<Transaction[]> {
    const repoOpts: FindAllOpts = {
      ...opts,
      userId: ctx.userId,
    };
    return this.repo.findAll(ctx.householdId, repoOpts);
  }

  async create(ctx: RequestContext, input: CreateTransactionInput): Promise<Transaction> {
    if (!Number.isInteger(input.amountCents)) {
      throw new BadRequestException('amountCents muss eine Ganzzahl sein');
    }

    return this.repo.create({
      householdId: ctx.householdId,
      createdByUserId: ctx.userId,
      amountCents: input.amountCents,
      plannedAmountCents: input.plannedAmountCents ?? null,
      isPlanned: input.isPlanned ?? false,
      categoryId: input.categoryId,
      projectId: input.projectId ?? null,
      date: parsePlainDate(input.date),
      description: input.description ?? null,
      visibility: input.visibility ?? Visibility.SHARED,
      recurringTransactionId: input.recurringTransactionId ?? null,
    });
  }

  async update(
    ctx: RequestContext,
    id: string,
    input: UpdateTransactionInput,
  ): Promise<Transaction> {
    const existing = await this.findAndAuthorize(ctx, id);

    if (input.amountCents !== undefined && !Number.isInteger(input.amountCents)) {
      throw new BadRequestException('amountCents muss eine Ganzzahl sein');
    }

    const data: UpdateTransactionData = {};
    if (input.amountCents !== undefined) data.amountCents = input.amountCents;
    if (input.categoryId !== undefined) data.categoryId = input.categoryId;
    if (input.projectId !== undefined) data.projectId = input.projectId;
    if (input.date !== undefined) data.date = parsePlainDate(input.date);
    if (input.description !== undefined) data.description = input.description;
    if (input.visibility !== undefined) data.visibility = input.visibility;
    if (input.recurringTransactionId !== undefined) {
      data.recurringTransactionId = input.recurringTransactionId;
    }
    if (input.plannedAmountCents !== undefined) {
      data.plannedAmountCents = input.plannedAmountCents;
    }

    // Auto-archive on planned -> realized transition: preserve the original
    // planned amount so the deviation (current amountCents - plannedAmountCents)
    // is visible in the UI. Client may override by passing plannedAmountCents.
    if (input.isPlanned !== undefined) {
      data.isPlanned = input.isPlanned;
      const wasPlanned = existing.isPlanned;
      const becomesRealized = wasPlanned && !input.isPlanned;
      if (becomesRealized && input.plannedAmountCents === undefined) {
        data.plannedAmountCents = existing.amountCents;
      }
    }

    return this.repo.update(existing.id, data);
  }

  async remove(ctx: RequestContext, id: string): Promise<void> {
    const existing = await this.findAndAuthorize(ctx, id);
    await this.repo.delete(existing.id);
  }

  toResponse(tx: Transaction) {
    return {
      id: tx.id,
      householdId: tx.householdId,
      createdByUserId: tx.createdByUserId,
      amountCents: tx.amountCents,
      plannedAmountCents: tx.plannedAmountCents,
      isPlanned: tx.isPlanned,
      categoryId: tx.categoryId,
      projectId: tx.projectId,
      date: tx.date.toISOString().slice(0, 10),
      description: tx.description,
      counterparty: tx.counterparty,
      visibility: tx.visibility,
      recurringTransactionId: tx.recurringTransactionId,
      createdAt: tx.createdAt.toISOString(),
      updatedAt: tx.updatedAt.toISOString(),
    };
  }

  private async findAndAuthorize(ctx: RequestContext, id: string): Promise<Transaction> {
    const tx = await this.repo.findById(id, ctx.householdId);
    if (!tx) throw new NotFoundException(`Transaktion ${id} nicht gefunden`);

    // Only the creator can modify/delete PRIVATE transactions
    if (tx.visibility === Visibility.PRIVATE && tx.createdByUserId !== ctx.userId) {
      throw new ForbiddenException('Kein Zugriff auf diese Transaktion');
    }

    return tx;
  }
}
