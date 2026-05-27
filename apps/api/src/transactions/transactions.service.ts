import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import type { Transaction } from '@prisma/client';
import { Visibility } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { RequestContext } from '../common/types/request-context.type';
import { AccountsService } from '../accounts/accounts.service';
import {
  TransactionsRepository,
  type FindAllOpts,
  type TransactionWithSplits,
  type UpdateTransactionData,
} from './transactions.repository';
import {
  RULE_EVENT,
  type TransactionCreatedEvent,
} from '../notification-rules/events/rule-events';

export { Visibility };

export interface TransactionSplitInput {
  /** Existing split id when editing — omitted/null on create. */
  id?: string | null;
  label: string;
  amountCents: number;
  sortOrder?: number;
  categoryId?: string | null;
  note?: string | null;
}

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
  color?: string | null;
  icon?: string | null;
  /** Optional internal split breakdown — sum must equal amountCents. */
  splits?: TransactionSplitInput[];
  /**
   * Optional account selection. When omitted, the household's default
   * csv_only account is used (FinTS Foundation 14a.1). Front-end picker
   * lands in a later UI phase.
   */
  accountId?: string;
}

export type UpdateTransactionInput = Partial<CreateTransactionInput>;

export interface ListOpts {
  categoryId?: string;
  projectId?: string;
  accountId?: string;
  month?: string; // 'YYYY-MM'
  isPlanned?: boolean;
}

function parsePlainDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

@Injectable()
export class TransactionsService {
  constructor(
    private readonly repo: TransactionsRepository,
    private readonly accounts: AccountsService,
    private readonly events: EventEmitter2,
  ) {}

  list(ctx: RequestContext, opts: ListOpts = {}): Promise<TransactionWithSplits[]> {
    const repoOpts: FindAllOpts = {
      ...opts,
      userId: ctx.userId,
    };
    return this.repo.findAll(ctx.householdId, repoOpts);
  }

  async create(ctx: RequestContext, input: CreateTransactionInput): Promise<TransactionWithSplits> {
    if (!Number.isInteger(input.amountCents)) {
      throw new BadRequestException('amountCents muss eine Ganzzahl sein');
    }
    this.validateSplitsSum(input.splits, input.amountCents);

    const accountId = input.accountId
      ? (await this.accounts.findById(input.accountId, ctx.householdId)).id
      : await this.accounts.ensureDefaultAccountId(ctx.householdId);

    const created = await this.repo.create({
      householdId: ctx.householdId,
      accountId,
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
      color: input.color ?? null,
      icon: input.icon ?? null,
    });
    let result: TransactionWithSplits = created;
    if (input.splits && input.splits.length > 0) {
      await this.repo.replaceSplits(created.id, input.splits);
      const reloaded = await this.repo.findById(created.id, ctx.householdId);
      if (reloaded) result = reloaded;
    }
    this.emitTransactionCreated(result, ctx.userId);
    return result;
  }

  private emitTransactionCreated(tx: TransactionWithSplits, ownerUserId: string | null): void {
    const event: TransactionCreatedEvent = {
      transactionId: tx.id,
      householdId: tx.householdId,
      ownerUserId: tx.createdByUserId ?? ownerUserId,
      visibility: tx.visibility,
      fields: {
        amountCents: tx.amountCents,
        isIncome: tx.amountCents > 0,
        kind: tx.transactionKind ?? null,
        categoryId: tx.categoryId,
        projectId: tx.projectId ?? null,
        accountId: tx.accountId,
        counterparty: tx.counterparty ?? null,
        description: tx.description ?? null,
        bookingText: tx.bookingText ?? null,
        date: tx.date.toISOString().slice(0, 10),
      },
    };
    this.events.emit(RULE_EVENT.TRANSACTION_CREATED, event);
  }

  /**
   * Hard rule: when splits are present, they must sum exactly to the
   * parent transaction's signed amountCents — that's the whole point of
   * splits being a breakdown rather than additive lines.
   */
  private validateSplitsSum(
    splits: { amountCents: number }[] | undefined,
    parentCents: number,
  ): void {
    if (!splits || splits.length === 0) return;
    const sum = splits.reduce((s, x) => s + x.amountCents, 0);
    if (sum !== parentCents) {
      throw new BadRequestException(
        `Splits müssen exakt ${parentCents} cents summieren (aktuell ${sum})`,
      );
    }
  }

  async update(
    ctx: RequestContext,
    id: string,
    input: UpdateTransactionInput,
  ): Promise<TransactionWithSplits> {
    const existing = await this.findAndAuthorize(ctx, id);

    if (input.amountCents !== undefined && !Number.isInteger(input.amountCents)) {
      throw new BadRequestException('amountCents muss eine Ganzzahl sein');
    }

    // FinTS Foundation (14a.8): bank-field lockout. When a transaction
    // came from a FinTS sync (bankFieldsLockedAt set), changes to fields
    // sourced from the bank are rejected. User-side classification
    // (category, project, visibility, color, icon, recurring link)
    // remains editable so the lessons learned by the user stay in sync
    // with the upstream bank data.
    if (existing.bankFieldsLockedAt) {
      const locked = ['amountCents', 'date', 'description'] as const;
      for (const f of locked) {
        if (input[f] !== undefined) {
          throw new BadRequestException(
            `Feld "${f}" ist gesperrt — Buchung stammt aus FinTS-Sync`,
          );
        }
      }
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
    if (input.color !== undefined) data.color = input.color;
    if (input.icon !== undefined) data.icon = input.icon;

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

    const newAmount = input.amountCents ?? existing.amountCents;
    if (input.splits !== undefined) {
      this.validateSplitsSum(input.splits, newAmount);
    }
    const updated = await this.repo.update(existing.id, data);
    if (input.splits !== undefined) {
      await this.repo.replaceSplits(updated.id, input.splits);
      const reloaded = await this.repo.findById(updated.id, ctx.householdId);
      if (reloaded) return reloaded;
    }
    return updated;
  }

  async remove(ctx: RequestContext, id: string): Promise<void> {
    const existing = await this.findAndAuthorize(ctx, id);
    if (existing.bankFieldsLockedAt) {
      throw new BadRequestException(
        'Buchung stammt aus FinTS-Sync und kann nicht gelöscht werden — beim nächsten Sync wird sie wieder importiert.',
      );
    }
    await this.repo.delete(existing.id);
  }

  /**
   * Bulk-move a set of transactions into a new category. Each id is
   * authorized via the same rules as single-update (PRIVATE only by creator).
   * Returns the count actually updated.
   */
  async bulkMove(ctx: RequestContext, ids: string[], categoryId: string): Promise<{ count: number }> {
    if (!Array.isArray(ids) || ids.length === 0) return { count: 0 };
    if (!categoryId) throw new BadRequestException('categoryId ist erforderlich');
    const allowedIds = await this.collectAuthorizedIds(ctx, ids);
    return this.repo.bulkUpdateCategory(allowedIds, ctx.householdId, categoryId);
  }

  /**
   * Bulk-update visibility on transactions (SHARED ↔ PRIVATE). Authorized
   * via the same rules as single-update: PRIVATE rows are only mutable by
   * their creator, so a user can't unilaterally expose another household
   * member's PRIVATE transactions. Bank-locked rows are NOT excluded —
   * visibility is a Klar-side concept, not part of the bank-locked fields.
   */
  async bulkSetVisibility(
    ctx: RequestContext,
    ids: string[],
    visibility: Visibility,
  ): Promise<{ count: number }> {
    if (!Array.isArray(ids) || ids.length === 0) return { count: 0 };
    if (visibility !== Visibility.PRIVATE && visibility !== Visibility.SHARED) {
      throw new BadRequestException('visibility muss PRIVATE oder SHARED sein');
    }
    const allowedIds = await this.collectAuthorizedIds(ctx, ids);
    return this.repo.bulkUpdateVisibility(allowedIds, ctx.householdId, visibility);
  }

  /**
   * Bulk-delete transactions. Each id is authorized via the same rules as
   * single-delete. Returns the count actually deleted.
   */
  async bulkDelete(ctx: RequestContext, ids: string[]): Promise<{ count: number }> {
    if (!Array.isArray(ids) || ids.length === 0) return { count: 0 };
    const allowedIds = await this.collectAuthorizedIds(ctx, ids);
    // FinTS Foundation (14a.8): silently skip bank-locked rows. Bulk delete
    // is a list-level action, so rejecting the entire batch over a single
    // FinTS row would surprise the user; partial-delete + count signals
    // what actually happened.
    const rows = await this.repo.findManyByIds(allowedIds, ctx.householdId);
    const deletable = rows
      .filter(r => r.bankFieldsLockedAt === null)
      .map(r => r.id);
    return this.repo.bulkDelete(deletable, ctx.householdId);
  }

  /**
   * Centralized authorization for bulk operations: returns the subset of ids
   * that exist in the household AND the user is allowed to mutate.
   * PRIVATE transactions are only mutable by their creator (mirrors
   * findAndAuthorize() for single-row writes).
   */
  private async collectAuthorizedIds(ctx: RequestContext, ids: string[]): Promise<string[]> {
    const found = await this.repo.findManyByIds(ids, ctx.householdId);
    return found
      .filter(tx => tx.visibility !== Visibility.PRIVATE || tx.createdByUserId === ctx.userId)
      .map(tx => tx.id);
  }

  toResponse(tx: Transaction | TransactionWithSplits) {
    const splits = (tx as TransactionWithSplits).splits ?? [];
    return {
      id: tx.id,
      householdId: tx.householdId,
      accountId: tx.accountId,
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
      // FinTS Foundation (14a.8): source + lockout marker so the FE can
      // render bank-field-locked indicators on FinTS-imported rows.
      source: tx.source,
      // Phase 14b: classifier derived from FinTS bookingType. Drives the
      // type chip on the transactions table (Dauerauftrag / SEPA-Lastschrift / …).
      transactionKind: tx.transactionKind,
      // Raw bank label ("Folgelastschrift", "Bargeldauszahlung", …). UI title-cases
      // it for display and uses it as a filter facet.
      bookingText: tx.bookingText,
      bankFieldsLockedAt: tx.bankFieldsLockedAt
        ? tx.bankFieldsLockedAt.toISOString()
        : null,
      fintsSyncRunId: tx.fintsSyncRunId,
      splits: splits.map(s => ({
        id: s.id,
        label: s.label,
        amountCents: s.amountCents,
        sortOrder: s.sortOrder,
        categoryId: s.categoryId,
        note: s.note,
      })),
      createdAt: tx.createdAt.toISOString(),
      updatedAt: tx.updatedAt.toISOString(),
    };
  }

  private async findAndAuthorize(ctx: RequestContext, id: string): Promise<TransactionWithSplits> {
    const tx = await this.repo.findById(id, ctx.householdId);
    if (!tx) throw new NotFoundException(`Transaktion ${id} nicht gefunden`);

    // Only the creator can modify/delete PRIVATE transactions
    if (tx.visibility === Visibility.PRIVATE && tx.createdByUserId !== ctx.userId) {
      throw new ForbiddenException('Kein Zugriff auf diese Transaktion');
    }

    return tx;
  }
}
