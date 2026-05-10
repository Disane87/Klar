import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import {
  FixedCostCycle,
  FixedCostSource,
  FixedCostStatus,
} from '@prisma/client';
import {
  detectFixedCosts,
  type FixedCostCycle as DetectedCycle,
  type FixedCostDetectionInput,
} from '@klar/shared';
import type { RequestContext } from '../common/types/request-context.type';
import {
  FixedCostsRepository,
  type CreateFixedCostData,
  type UpdateFixedCostData,
  type FixedCostWithContract,
} from './fixed-costs.repository';

export { FixedCostCycle, FixedCostSource, FixedCostStatus };

export interface CreateFixedCostInput {
  name: string;
  merchant?: string | null;
  categoryId?: string | null;
  amountCents: number;
  cycle: FixedCostCycle;
  nextRenewalAt?: string | null;
  status?: FixedCostStatus;
}

export type UpdateFixedCostInput = Partial<CreateFixedCostInput>;

export interface ListFixedCostsOpts {
  status?: FixedCostStatus;
  source?: FixedCostSource;
  contractsOnly?: boolean;
}

function parsePlainDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function parsePlainDateOptional(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  return parsePlainDate(iso);
}

function detectedCycleToPrisma(c: DetectedCycle): FixedCostCycle {
  return c as FixedCostCycle;
}

@Injectable()
export class FixedCostsService {
  private readonly logger = new Logger(FixedCostsService.name);

  constructor(private readonly repo: FixedCostsRepository) {}

  list(
    ctx: RequestContext,
    opts: ListFixedCostsOpts = {},
  ): Promise<FixedCostWithContract[]> {
    return this.repo.findAll(ctx.householdId, opts);
  }

  async create(
    ctx: RequestContext,
    input: CreateFixedCostInput,
  ): Promise<FixedCostWithContract> {
    this.validate(input);
    const data: CreateFixedCostData = {
      householdId: ctx.householdId,
      name: input.name.trim(),
      merchant: input.merchant ?? null,
      categoryId: input.categoryId ?? null,
      amountCents: input.amountCents,
      cycle: input.cycle,
      nextRenewalAt: parsePlainDateOptional(input.nextRenewalAt),
      confidence: 1,
      status: input.status ?? FixedCostStatus.CONFIRMED,
      source: FixedCostSource.USER_DEFINED,
    };
    return this.repo.create(data);
  }

  async update(
    ctx: RequestContext,
    id: string,
    input: UpdateFixedCostInput,
  ): Promise<FixedCostWithContract> {
    const existing = await this.repo.findById(id, ctx.householdId);
    if (!existing) throw new NotFoundException(`Fixkosten-Eintrag ${id} nicht gefunden`);
    if (input.amountCents !== undefined && !Number.isInteger(input.amountCents)) {
      throw new BadRequestException('amountCents muss eine Ganzzahl sein');
    }
    const data: UpdateFixedCostData = {};
    if (input.name !== undefined) data.name = input.name.trim();
    if (input.merchant !== undefined) data.merchant = input.merchant;
    if (input.categoryId !== undefined) data.categoryId = input.categoryId;
    if (input.amountCents !== undefined) data.amountCents = input.amountCents;
    if (input.cycle !== undefined) data.cycle = input.cycle;
    if (input.nextRenewalAt !== undefined)
      data.nextRenewalAt = parsePlainDateOptional(input.nextRenewalAt);
    if (input.status !== undefined) data.status = input.status;
    return this.repo.update(existing.id, ctx.householdId, data);
  }

  async remove(ctx: RequestContext, id: string): Promise<void> {
    const existing = await this.repo.findById(id, ctx.householdId);
    if (!existing) throw new NotFoundException(`Fixkosten-Eintrag ${id} nicht gefunden`);
    await this.repo.delete(existing.id, ctx.householdId);
  }

  async bulkUpdateStatus(
    ctx: RequestContext,
    ids: readonly string[],
    status: FixedCostStatus,
  ): Promise<{ updated: number }> {
    const updated = await this.repo.bulkUpdateStatus(ctx.householdId, ids, status);
    return { updated };
  }

  /**
   * Run the unified detection algorithm for a single household and
   * upsert the resulting CANDIDATE rows. Called from:
   *   - the manual /recompute endpoint
   *   - after a CSV import confirmation succeeds
   *   - after a FinTS sync run finishes
   * Idempotent: re-running yields the same CANDIDATE set; user-curated rows
   * (CONFIRMED, DETECTED, CANCELLED) and USER_DEFINED rows are preserved.
   */
  async recomputeForHousehold(
    householdId: string,
  ): Promise<{ created: number; replaced: number }> {
    const txs = await this.repo.loadDetectionInput(householdId);
    const inputs: FixedCostDetectionInput[] = txs.map(t => ({
      id: t.id,
      date: t.date.toISOString().slice(0, 10),
      amountCents: t.amountCents,
      counterparty: t.counterparty,
      purpose: t.description,
    }));
    const candidates = detectFixedCosts(inputs);

    const data: CreateFixedCostData[] = candidates.map(c => ({
      householdId,
      name: c.name,
      merchant: c.merchantKey,
      amountCents: c.amountCents,
      cycle: detectedCycleToPrisma(c.cycle),
      nextRenewalAt: c.nextRenewalAt ? parsePlainDate(c.nextRenewalAt) : null,
      confidence: c.confidence,
      status: FixedCostStatus.CANDIDATE,
      source: FixedCostSource.AUTO_DETECTED,
      detectedFromTransactionIds: c.transactionIds,
    }));

    const result = await this.repo.replaceAutoCandidates(householdId, data);
    this.logger.log(
      `Detection household=${householdId}: replaced ${result.deleted} → ${result.created} CANDIDATE rows`,
    );
    return { created: result.created, replaced: result.deleted };
  }

  /** Convenience wrapper around {@link recomputeForHousehold} for controllers. */
  recompute(ctx: RequestContext): Promise<{ created: number; replaced: number }> {
    return this.recomputeForHousehold(ctx.householdId);
  }

  toResponse(c: FixedCostWithContract) {
    return {
      id: c.id,
      householdId: c.householdId,
      name: c.name,
      merchant: c.merchant,
      categoryId: c.categoryId,
      amountCents: c.amountCents,
      cycle: c.cycle,
      nextRenewalAt: c.nextRenewalAt
        ? c.nextRenewalAt.toISOString().slice(0, 10)
        : null,
      confidence: c.confidence,
      status: c.status,
      source: c.source,
      detectedFromTransactionIds: c.detectedFromTransactionIds,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
      contract: c.contract
        ? {
            id: c.contract.id,
            cancelByAt: c.contract.cancelByAt
              ? c.contract.cancelByAt.toISOString().slice(0, 10)
              : null,
            contractStartedAt: c.contract.contractStartedAt
              ? c.contract.contractStartedAt.toISOString().slice(0, 10)
              : null,
            contractHolder: c.contract.contractHolder,
            contractNumber: c.contract.contractNumber,
            providerName: c.contract.providerName,
            documentUrl: c.contract.documentUrl,
            notes: c.contract.notes,
            createdAt: c.contract.createdAt.toISOString(),
            updatedAt: c.contract.updatedAt.toISOString(),
          }
        : null,
    };
  }

  private validate(input: CreateFixedCostInput): void {
    if (!input.name?.trim()) {
      throw new BadRequestException('Name ist erforderlich');
    }
    if (!Number.isInteger(input.amountCents)) {
      throw new BadRequestException('amountCents muss eine Ganzzahl sein');
    }
    if (!input.cycle || !Object.values(FixedCostCycle).includes(input.cycle)) {
      throw new BadRequestException('Ungültiger cycle');
    }
  }
}
