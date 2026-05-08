import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type {
  StandingOrderFrequency,
  StandingOrderSource,
  TransactionKind,
} from '@prisma/client';

export interface ListStandingOrderTxRow {
  date: string;
  amountCents: number;
  counterpartyName: string | null;
  counterpartyIban: string | null;
  transactionKind: TransactionKind;
}

export interface UpsertInput {
  householdId: string;
  accountId: string;
  groupKey: string;
  source: StandingOrderSource;
  transactionKind: TransactionKind | null;
  counterpartyName: string | null;
  counterpartyIban: string | null;
  amountCents: number;
  frequency: StandingOrderFrequency;
  lastSeenAt: string;
  nextExpectedAt: string | null;
}

@Injectable()
export class StandingOrdersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listStandingOrderTransactions(ctx: {
    householdId: string;
    accountId: string;
  }): Promise<ListStandingOrderTxRow[]> {
    const rows = await this.prisma.transaction.findMany({
      where: {
        householdId: ctx.householdId,
        accountId: ctx.accountId,
        // Detection covers both real Bank-Daueraufträge and SEPA-Folgelastschriften.
        // The kind survives on the resulting StandingOrder so the UI can chip them apart.
        transactionKind: { in: ['STANDING_ORDER', 'DIRECT_DEBIT'] },
      },
      select: {
        date: true,
        amountCents: true,
        counterparty: true,
        transactionKind: true,
      },
      orderBy: { date: 'asc' },
    });
    return rows.map(r => ({
      date: r.date.toISOString().slice(0, 10),
      amountCents: r.amountCents,
      counterpartyName: r.counterparty,
      counterpartyIban: null,
      // The query filters on { in: [...] } so the field is non-null in practice;
      // the cast is safe because Prisma's selected union type widens to nullable.
      transactionKind: r.transactionKind as TransactionKind,
    }));
  }

  async upsertByGroupKey(input: UpsertInput): Promise<void> {
    const lastSeenAt = new Date(`${input.lastSeenAt}T00:00:00Z`);
    const nextExpectedAt = input.nextExpectedAt
      ? new Date(`${input.nextExpectedAt}T00:00:00Z`)
      : null;

    await this.prisma.standingOrder.upsert({
      where: {
        householdId_accountId_groupKey: {
          householdId: input.householdId,
          accountId: input.accountId,
          groupKey: input.groupKey,
        },
      },
      create: {
        householdId: input.householdId,
        accountId: input.accountId,
        groupKey: input.groupKey,
        source: input.source,
        transactionKind: input.transactionKind,
        counterpartyName: input.counterpartyName,
        counterpartyIban: input.counterpartyIban,
        amountCents: input.amountCents,
        frequency: input.frequency,
        lastSeenAt,
        nextExpectedAt,
        bankFieldsLockedAt: input.source === 'FINTS_DERIVED' ? new Date() : null,
      },
      update: {
        // Bank is source of truth — overwrite bank fields.
        transactionKind: input.transactionKind,
        counterpartyName: input.counterpartyName,
        counterpartyIban: input.counterpartyIban,
        amountCents: input.amountCents,
        frequency: input.frequency,
        lastSeenAt,
        nextExpectedAt,
        bankFieldsLockedAt: input.source === 'FINTS_DERIVED' ? new Date() : null,
        // categoryId / note / isActive are user fields — DO NOT touch.
      },
    });
  }
}
