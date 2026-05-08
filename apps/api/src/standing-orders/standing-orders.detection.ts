import { Injectable, Logger } from '@nestjs/common';
import type { TransactionKind } from '@prisma/client';
import { deriveFrequency, type DerivedFrequency } from '@klar/shared';
import { StandingOrdersRepository } from './standing-orders.repository';

export interface DetectionContext {
  householdId: string;
  accountId: string;
}

interface InboundTx {
  date: string;
  amountCents: number;
  counterpartyName: string | null;
  counterpartyIban: string | null;
  transactionKind: TransactionKind;
}

// Minimum group size to surface as a recurring record.
// Bank-Daueraufträge are explicit user instructions, so 2 occurrences is enough.
// SEPA direct debits include one-off refunds and merchant tests — require 3 to
// avoid noise (e.g. Amazon refund + reversal both pointing at same merchant).
const MIN_OCCURRENCES: Record<TransactionKind, number> = {
  STANDING_ORDER: 2,
  DIRECT_DEBIT: 3,
  TRANSFER: Number.POSITIVE_INFINITY,
  CARD: Number.POSITIVE_INFINITY,
  FEE: Number.POSITIVE_INFINITY,
  OTHER: Number.POSITIVE_INFINITY,
};

@Injectable()
export class StandingOrdersDetection {
  private readonly logger = new Logger(StandingOrdersDetection.name);

  constructor(private readonly repo: StandingOrdersRepository) {}

  async runForAccount(ctx: DetectionContext): Promise<{ upserted: number }> {
    const txs = await this.repo.listStandingOrderTransactions(ctx);
    if (txs.length === 0) return { upserted: 0 };

    const groups = new Map<string, { sample: InboundTx; dates: string[] }>();
    for (const tx of txs) {
      const key = makeGroupKey(tx);
      const g = groups.get(key);
      if (g) {
        g.dates.push(tx.date);
      } else {
        groups.set(key, { sample: tx, dates: [tx.date] });
      }
    }

    let upserted = 0;
    for (const [groupKey, { sample, dates }] of groups) {
      const minOccur = MIN_OCCURRENCES[sample.transactionKind];
      if (dates.length < minOccur) continue;

      const sorted = [...dates].sort();
      const lastSeenAt = sorted[sorted.length - 1];
      const frequency = deriveFrequency(sorted);
      const nextExpectedAt = computeNextExpected(lastSeenAt, frequency);

      await this.repo.upsertByGroupKey({
        householdId: ctx.householdId,
        accountId: ctx.accountId,
        groupKey,
        source: 'FINTS_DERIVED',
        transactionKind: sample.transactionKind,
        counterpartyName: sample.counterpartyName,
        counterpartyIban: sample.counterpartyIban,
        amountCents: sample.amountCents,
        frequency,
        lastSeenAt,
        nextExpectedAt,
      });
      upserted++;
    }

    this.logger.log(
      `Standing-order detection: account=${ctx.accountId} groups=${groups.size} upserted=${upserted}`,
    );
    return { upserted };
  }
}

// groupKey separates kinds so a Bank-Dauerauftrag and a SEPA-Lastschrift to the
// same recipient with the same amount produce two records (different chips).
function makeGroupKey(tx: InboundTx): string {
  const name = (tx.counterpartyName ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
  return `${tx.transactionKind.toLowerCase()}|${name}|${tx.amountCents}`;
}

function computeNextExpected(
  lastSeenIso: string,
  freq: DerivedFrequency,
): string | null {
  const days: Record<Exclude<DerivedFrequency, 'CUSTOM' | 'UNKNOWN'>, number> = {
    WEEKLY: 7,
    MONTHLY: 30,
    QUARTERLY: 91,
    HALF_YEARLY: 182,
    YEARLY: 365,
  };
  if (freq === 'CUSTOM' || freq === 'UNKNOWN') return null;
  const d = new Date(`${lastSeenIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days[freq]);
  return d.toISOString().slice(0, 10);
}
