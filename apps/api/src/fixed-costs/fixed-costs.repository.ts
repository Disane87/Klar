import { Injectable } from '@nestjs/common';
import type {
  Contract,
  FixedCost,
  FixedCostCycle,
  FixedCostSource,
  FixedCostStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateFixedCostData {
  householdId: string;
  name: string;
  merchant?: string | null;
  categoryId?: string | null;
  amountCents: number;
  cycle: FixedCostCycle;
  nextRenewalAt?: Date | null;
  confidence?: number;
  status?: FixedCostStatus;
  source?: FixedCostSource;
  detectedFromTransactionIds?: string[];
}

export interface UpdateFixedCostData {
  name?: string;
  merchant?: string | null;
  categoryId?: string | null;
  amountCents?: number;
  cycle?: FixedCostCycle;
  nextRenewalAt?: Date | null;
  confidence?: number;
  status?: FixedCostStatus;
}

export interface FindAllOpts {
  status?: FixedCostStatus;
  source?: FixedCostSource;
  /** When true, return only fixed costs that have a Contract extension. */
  contractsOnly?: boolean;
}

export type FixedCostWithContract = FixedCost & { contract: Contract | null };

@Injectable()
export class FixedCostsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll(
    householdId: string,
    opts: FindAllOpts = {},
  ): Promise<FixedCostWithContract[]> {
    return this.prisma.fixedCost.findMany({
      where: {
        householdId,
        ...(opts.status ? { status: opts.status } : {}),
        ...(opts.source ? { source: opts.source } : {}),
        ...(opts.contractsOnly ? { contract: { isNot: null } } : {}),
      },
      include: { contract: true },
      orderBy: [{ status: 'asc' }, { nextRenewalAt: 'asc' }, { name: 'asc' }],
    });
  }

  findById(
    id: string,
    householdId: string,
  ): Promise<FixedCostWithContract | null> {
    return this.prisma.fixedCost.findFirst({
      where: { id, householdId },
      include: { contract: true },
    });
  }

  create(data: CreateFixedCostData): Promise<FixedCostWithContract> {
    return this.prisma.fixedCost.create({
      data: {
        householdId: data.householdId,
        name: data.name,
        merchant: data.merchant ?? null,
        categoryId: data.categoryId ?? null,
        amountCents: data.amountCents,
        cycle: data.cycle,
        nextRenewalAt: data.nextRenewalAt ?? null,
        confidence: data.confidence ?? 0,
        ...(data.status ? { status: data.status } : {}),
        ...(data.source ? { source: data.source } : {}),
        detectedFromTransactionIds: data.detectedFromTransactionIds ?? [],
      },
      include: { contract: true },
    });
  }

  update(
    id: string,
    householdId: string,
    data: UpdateFixedCostData,
  ): Promise<FixedCostWithContract> {
    const update: Prisma.FixedCostUpdateInput = {};
    if (data.name !== undefined) update.name = data.name;
    if (data.merchant !== undefined) update.merchant = data.merchant;
    if (data.categoryId !== undefined) update.categoryId = data.categoryId;
    if (data.amountCents !== undefined) update.amountCents = data.amountCents;
    if (data.cycle !== undefined) update.cycle = data.cycle;
    if (data.nextRenewalAt !== undefined) update.nextRenewalAt = data.nextRenewalAt;
    if (data.confidence !== undefined) update.confidence = data.confidence;
    if (data.status !== undefined) update.status = data.status;
    return this.prisma.fixedCost.update({
      where: { id, householdId } as unknown as Prisma.FixedCostWhereUniqueInput,
      data: update,
      include: { contract: true },
    });
  }

  async delete(id: string, householdId: string): Promise<void> {
    await this.prisma.fixedCost.deleteMany({ where: { id, householdId } });
  }

  /** Bulk-update status for multiple fixed costs in one call (batch confirm/cancel). */
  async bulkUpdateStatus(
    householdId: string,
    ids: readonly string[],
    status: FixedCostStatus,
  ): Promise<number> {
    if (ids.length === 0) return 0;
    const result = await this.prisma.fixedCost.updateMany({
      where: { householdId, id: { in: [...ids] } },
      data: { status },
    });
    return result.count;
  }

  /** Returns ALL household transactions with the fields the detector needs. */
  async loadDetectionInput(
    householdId: string,
  ): Promise<
    Array<{
      id: string;
      date: Date;
      amountCents: number;
      counterparty: string | null;
      description: string | null;
    }>
  > {
    return this.prisma.transaction.findMany({
      where: { householdId },
      select: {
        id: true,
        date: true,
        amountCents: true,
        counterparty: true,
        description: true,
      },
      orderBy: { date: 'asc' },
    });
  }

  /**
   * Bulk-replace AUTO_DETECTED candidate rows for the household. Preserves
   * AUTO_DETECTED rows the user has CONFIRMED/DETECTED/CANCELLED, and
   * preserves all USER_DEFINED rows. Idempotency: re-running yields the
   * same set of CANDIDATE rows.
   */
  async replaceAutoCandidates(
    householdId: string,
    candidates: CreateFixedCostData[],
  ): Promise<{ deleted: number; created: number }> {
    return this.prisma.$transaction(async tx => {
      const deleted = await tx.fixedCost.deleteMany({
        where: {
          householdId,
          status: 'CANDIDATE',
          source: 'AUTO_DETECTED',
        },
      });
      let created = 0;
      for (const c of candidates) {
        await tx.fixedCost.create({
          data: {
            householdId,
            name: c.name,
            merchant: c.merchant ?? null,
            categoryId: c.categoryId ?? null,
            amountCents: c.amountCents,
            cycle: c.cycle,
            nextRenewalAt: c.nextRenewalAt ?? null,
            confidence: c.confidence ?? 0,
            status: c.status ?? 'CANDIDATE',
            source: c.source ?? 'AUTO_DETECTED',
            detectedFromTransactionIds: c.detectedFromTransactionIds ?? [],
          },
        });
        created++;
      }
      return { deleted: deleted.count, created };
    });
  }
}
