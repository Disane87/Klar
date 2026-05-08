import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  StandingOrder,
  StandingOrderFrequency,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { RequestContext } from '../common/types/request-context.type';

export interface CreateStandingOrderInput {
  accountId: string;
  counterpartyName?: string | null;
  counterpartyIban?: string | null;
  amountCents: number;
  currency?: string;
  frequency: StandingOrderFrequency;
  nextExpectedAt?: string | null;
  categoryId?: string | null;
  note?: string | null;
}

export interface UpdateStandingOrderInput {
  // User fields — always allowed.
  categoryId?: string | null;
  note?: string | null;
  isActive?: boolean;
  // Bank fields — allowed only for source=MANUAL.
  counterpartyName?: string | null;
  counterpartyIban?: string | null;
  amountCents?: number;
  frequency?: StandingOrderFrequency;
  nextExpectedAt?: string | null;
}

const BANK_FIELDS: (keyof UpdateStandingOrderInput)[] = [
  'counterpartyName',
  'counterpartyIban',
  'amountCents',
  'frequency',
  'nextExpectedAt',
];

@Injectable()
export class StandingOrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    ctx: RequestContext,
    opts: { includeInactive?: boolean } = {},
  ): Promise<StandingOrder[]> {
    return this.prisma.standingOrder.findMany({
      where: {
        householdId: ctx.householdId,
        ...(opts.includeInactive ? {} : { isActive: true }),
      },
      orderBy: [{ nextExpectedAt: 'asc' }, { counterpartyName: 'asc' }],
    });
  }

  async create(
    ctx: RequestContext,
    input: CreateStandingOrderInput,
  ): Promise<StandingOrder> {
    if (!input.accountId) throw new BadRequestException('accountId required');
    if (typeof input.amountCents !== 'number') {
      throw new BadRequestException('amountCents required');
    }
    const groupKey = makeManualGroupKey(input.counterpartyName, input.amountCents);

    return this.prisma.standingOrder.create({
      data: {
        householdId: ctx.householdId,
        accountId: input.accountId,
        groupKey,
        source: 'MANUAL',
        counterpartyName: input.counterpartyName ?? null,
        counterpartyIban: input.counterpartyIban ?? null,
        amountCents: input.amountCents,
        currency: input.currency ?? 'EUR',
        frequency: input.frequency,
        nextExpectedAt: input.nextExpectedAt
          ? new Date(`${input.nextExpectedAt}T00:00:00Z`)
          : null,
        categoryId: input.categoryId ?? null,
        note: input.note ?? null,
      },
    });
  }

  async update(
    ctx: RequestContext,
    id: string,
    patch: UpdateStandingOrderInput,
  ): Promise<StandingOrder> {
    const existing = await this.prisma.standingOrder.findUnique({ where: { id } });
    if (!existing || existing.householdId !== ctx.householdId) {
      throw new NotFoundException('StandingOrder not found');
    }

    if (existing.source === 'FINTS_DERIVED') {
      for (const f of BANK_FIELDS) {
        if (patch[f] !== undefined) {
          throw new BadRequestException(
            `Field "${f}" is bank-locked on FinTS-derived records`,
          );
        }
      }
    }

    return this.prisma.standingOrder.update({
      where: { id },
      data: {
        ...(patch.categoryId !== undefined && { categoryId: patch.categoryId }),
        ...(patch.note !== undefined && { note: patch.note }),
        ...(patch.isActive !== undefined && { isActive: patch.isActive }),
        ...(patch.counterpartyName !== undefined && { counterpartyName: patch.counterpartyName }),
        ...(patch.counterpartyIban !== undefined && { counterpartyIban: patch.counterpartyIban }),
        ...(patch.amountCents !== undefined && { amountCents: patch.amountCents }),
        ...(patch.frequency !== undefined && { frequency: patch.frequency }),
        ...(patch.nextExpectedAt !== undefined && {
          nextExpectedAt: patch.nextExpectedAt
            ? new Date(`${patch.nextExpectedAt}T00:00:00Z`)
            : null,
        }),
      },
    });
  }

  async remove(ctx: RequestContext, id: string): Promise<void> {
    const existing = await this.prisma.standingOrder.findUnique({ where: { id } });
    if (!existing || existing.householdId !== ctx.householdId) {
      throw new NotFoundException('StandingOrder not found');
    }
    if (existing.source === 'FINTS_DERIVED') {
      throw new BadRequestException(
        'FinTS-derived standing orders cannot be deleted — use isActive=false instead',
      );
    }
    await this.prisma.standingOrder.delete({ where: { id } });
  }
}

function makeManualGroupKey(
  name: string | null | undefined,
  amountCents: number,
): string {
  const norm = (name ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
  // Manual records use a "manual:" prefix to never collide with FINTS_DERIVED
  // groupKey ("counterparty|amount") — prevents accidental upsert overwrite.
  return `manual:${norm}|${amountCents}|${Date.now()}`;
}
