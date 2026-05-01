import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import type { RecurringTransaction } from '@prisma/client';
import { RecurringFrequency, Visibility } from '@prisma/client';
import type { RequestContext } from '../common/types/request-context.type';
import {
  RecurringTransactionsRepository,
  type FindAllOpts,
  type UpdateRecurringTransactionData,
} from './recurring-transactions.repository';

export { RecurringFrequency, Visibility };

export interface CreateRecurringTransactionInput {
  name: string;
  amountCents: number;
  categoryId: string;
  projectId?: string | null;
  frequency: RecurringFrequency;
  customDays?: number | null;
  dayOfMonth?: number | null;
  startDate: string; // ISO YYYY-MM-DD
  endDate?: string | null; // ISO YYYY-MM-DD
  visibility?: Visibility;
  isVariable?: boolean;
  note?: string | null;
  isActive?: boolean;
}

export type UpdateRecurringTransactionInput = Partial<CreateRecurringTransactionInput>;

export interface ListOpts {
  categoryId?: string;
  projectId?: string;
  isActive?: boolean;
}

function parsePlainDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function parsePlainDateOptional(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  return parsePlainDate(iso);
}

@Injectable()
export class RecurringTransactionsService {
  constructor(private readonly repo: RecurringTransactionsRepository) {}

  list(ctx: RequestContext, opts: ListOpts = {}): Promise<RecurringTransaction[]> {
    const repoOpts: FindAllOpts = {
      ...opts,
      userId: ctx.userId,
    };
    return this.repo.findAll(ctx.householdId, repoOpts);
  }

  async create(
    ctx: RequestContext,
    input: CreateRecurringTransactionInput,
  ): Promise<RecurringTransaction> {
    this.validateInput(input);

    return this.repo.create({
      householdId: ctx.householdId,
      createdByUserId: ctx.userId,
      name: input.name.trim(),
      amountCents: input.amountCents,
      categoryId: input.categoryId,
      projectId: input.projectId ?? null,
      frequency: input.frequency,
      customDays: input.customDays ?? null,
      dayOfMonth: input.dayOfMonth ?? null,
      startDate: parsePlainDate(input.startDate),
      endDate: parsePlainDateOptional(input.endDate),
      visibility: input.visibility ?? Visibility.SHARED,
      isVariable: input.isVariable ?? false,
      note: input.note ?? null,
      isActive: input.isActive ?? true,
    });
  }

  async update(
    ctx: RequestContext,
    id: string,
    input: UpdateRecurringTransactionInput,
  ): Promise<RecurringTransaction> {
    const existing = await this.findAndAuthorize(ctx, id);

    if (input.frequency !== undefined || input.customDays !== undefined) {
      this.validateInput({
        ...existing,
        startDate: existing.startDate.toISOString().slice(0, 10),
        frequency: input.frequency ?? existing.frequency,
        customDays: input.customDays !== undefined ? input.customDays : existing.customDays,
        dayOfMonth: input.dayOfMonth !== undefined ? input.dayOfMonth : existing.dayOfMonth,
        amountCents: input.amountCents ?? existing.amountCents,
        name: input.name ?? existing.name,
        categoryId: input.categoryId ?? existing.categoryId,
      });
    }

    const data: UpdateRecurringTransactionData = {};
    if (input.name !== undefined) data.name = input.name.trim();
    if (input.amountCents !== undefined) {
      if (!Number.isInteger(input.amountCents)) {
        throw new BadRequestException('amountCents muss eine Ganzzahl sein');
      }
      data.amountCents = input.amountCents;
    }
    if (input.categoryId !== undefined) data.categoryId = input.categoryId;
    if (input.projectId !== undefined) data.projectId = input.projectId;
    if (input.frequency !== undefined) data.frequency = input.frequency;
    if (input.customDays !== undefined) data.customDays = input.customDays;
    if (input.dayOfMonth !== undefined) data.dayOfMonth = input.dayOfMonth;
    if (input.startDate !== undefined) data.startDate = parsePlainDate(input.startDate);
    if (input.endDate !== undefined) data.endDate = parsePlainDateOptional(input.endDate);
    if (input.visibility !== undefined) data.visibility = input.visibility;
    if (input.isVariable !== undefined) data.isVariable = input.isVariable;
    if (input.note !== undefined) data.note = input.note;

    return this.repo.update(existing.id, data);
  }

  async remove(ctx: RequestContext, id: string): Promise<void> {
    const existing = await this.findAndAuthorize(ctx, id);
    await this.repo.delete(existing.id);
  }

  async setActive(ctx: RequestContext, id: string, isActive: boolean): Promise<RecurringTransaction> {
    const existing = await this.findAndAuthorize(ctx, id);
    return this.repo.setActive(existing.id, isActive);
  }

  toResponse(rt: RecurringTransaction) {
    return {
      id: rt.id,
      householdId: rt.householdId,
      createdByUserId: rt.createdByUserId,
      name: rt.name,
      amountCents: rt.amountCents,
      categoryId: rt.categoryId,
      projectId: rt.projectId,
      frequency: rt.frequency,
      customDays: rt.customDays,
      dayOfMonth: rt.dayOfMonth,
      startDate: rt.startDate.toISOString().slice(0, 10),
      endDate: rt.endDate ? rt.endDate.toISOString().slice(0, 10) : null,
      visibility: rt.visibility,
      isVariable: rt.isVariable,
      note: rt.note,
      isActive: rt.isActive,
      createdAt: rt.createdAt.toISOString(),
      updatedAt: rt.updatedAt.toISOString(),
    };
  }

  private validateInput(
    input: Pick<
      CreateRecurringTransactionInput,
      'amountCents' | 'frequency' | 'customDays' | 'dayOfMonth' | 'name' | 'categoryId' | 'startDate'
    >,
  ): void {
    if (!Number.isInteger(input.amountCents)) {
      throw new BadRequestException('amountCents muss eine Ganzzahl sein');
    }

    if (input.frequency === RecurringFrequency.CUSTOM_DAYS) {
      if (!input.customDays || input.customDays <= 0) {
        throw new BadRequestException(
          'customDays muss angegeben werden und größer als 0 sein wenn frequency=CUSTOM_DAYS',
        );
      }
    }

    if (input.dayOfMonth !== null && input.dayOfMonth !== undefined) {
      if (input.dayOfMonth < 1 || input.dayOfMonth > 31) {
        throw new BadRequestException('dayOfMonth muss zwischen 1 und 31 liegen');
      }
    }
  }

  private async findAndAuthorize(
    ctx: RequestContext,
    id: string,
  ): Promise<RecurringTransaction> {
    const rt = await this.repo.findById(id, ctx.householdId);
    if (!rt) throw new NotFoundException(`Wiederkehrende Buchung ${id} nicht gefunden`);

    // Only the creator can modify/delete PRIVATE recurring transactions
    if (rt.visibility === Visibility.PRIVATE && rt.createdByUserId !== ctx.userId) {
      throw new ForbiddenException('Kein Zugriff auf diese wiederkehrende Buchung');
    }

    return rt;
  }
}
