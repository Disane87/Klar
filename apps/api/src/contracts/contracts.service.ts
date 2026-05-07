import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import type { Contract } from '@prisma/client';
import { ContractCycle, ContractStatus } from '@prisma/client';
import {
  detectContracts,
  type ContractCycleLite,
  type DetectInputTransaction,
} from '@klar/shared';
import type { RequestContext } from '../common/types/request-context.type';
import {
  ContractsRepository,
  type CreateContractData,
  type UpdateContractData,
} from './contracts.repository';

export { ContractCycle, ContractStatus };

export interface CreateContractInput {
  name: string;
  merchant?: string | null;
  categoryId?: string | null;
  amountCents: number;
  cycle: ContractCycle;
  nextRenewalAt?: string | null;
  cancelByAt?: string | null;
  status?: ContractStatus;
}

export type UpdateContractInput = Partial<CreateContractInput>;

export interface ListContractsOpts {
  status?: ContractStatus;
}

function parsePlainDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function parsePlainDateOptional(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  return parsePlainDate(iso);
}

function normalizeMerchantKey(raw: string | null | undefined): string {
  if (!raw) return '';
  return raw
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 64);
}

function liteToCycle(c: ContractCycleLite): ContractCycle {
  return c as ContractCycle;
}

@Injectable()
export class ContractsService {
  constructor(private readonly repo: ContractsRepository) {}

  list(ctx: RequestContext, opts: ListContractsOpts = {}): Promise<Contract[]> {
    return this.repo.findAll(ctx.householdId, opts);
  }

  async create(ctx: RequestContext, input: CreateContractInput): Promise<Contract> {
    this.validate(input);
    const data: CreateContractData = {
      householdId: ctx.householdId,
      name: input.name.trim(),
      merchant: input.merchant ?? null,
      categoryId: input.categoryId ?? null,
      amountCents: input.amountCents,
      cycle: input.cycle,
      nextRenewalAt: parsePlainDateOptional(input.nextRenewalAt),
      cancelByAt: parsePlainDateOptional(input.cancelByAt),
      confidence: 1,
      status: input.status ?? ContractStatus.CONFIRMED,
    };
    return this.repo.create(data);
  }

  async update(ctx: RequestContext, id: string, input: UpdateContractInput): Promise<Contract> {
    const existing = await this.repo.findById(id, ctx.householdId);
    if (!existing) throw new NotFoundException(`Vertrag ${id} nicht gefunden`);
    if (input.amountCents !== undefined && !Number.isInteger(input.amountCents)) {
      throw new BadRequestException('amountCents muss eine Ganzzahl sein');
    }
    const data: UpdateContractData = {};
    if (input.name !== undefined) data.name = input.name.trim();
    if (input.merchant !== undefined) data.merchant = input.merchant;
    if (input.categoryId !== undefined) data.categoryId = input.categoryId;
    if (input.amountCents !== undefined) data.amountCents = input.amountCents;
    if (input.cycle !== undefined) data.cycle = input.cycle;
    if (input.nextRenewalAt !== undefined) data.nextRenewalAt = parsePlainDateOptional(input.nextRenewalAt);
    if (input.cancelByAt !== undefined) data.cancelByAt = parsePlainDateOptional(input.cancelByAt);
    if (input.status !== undefined) data.status = input.status;
    return this.repo.update(existing.id, ctx.householdId, data);
  }

  async remove(ctx: RequestContext, id: string): Promise<void> {
    const existing = await this.repo.findById(id, ctx.householdId);
    if (!existing) throw new NotFoundException(`Vertrag ${id} nicht gefunden`);
    await this.repo.delete(existing.id, ctx.householdId);
  }

  /**
   * Recompute candidate contracts from current transactions.
   * Discards previous CANDIDATE rows, keeps CONFIRMED/CANCELLED untouched.
   */
  async recompute(ctx: RequestContext): Promise<{ created: number; replaced: number }> {
    const txs = await this.repo.loadDetectionInput(ctx.householdId);
    const inputs: DetectInputTransaction[] = txs.map(t => ({
      id: t.id,
      date: t.date.toISOString().slice(0, 10),
      amountCents: t.amountCents,
      merchantKey: normalizeMerchantKey(t.counterparty),
    }));
    const candidates = detectContracts(inputs);

    const data: CreateContractData[] = candidates.map(c => ({
      householdId: ctx.householdId,
      name: c.name,
      merchant: c.merchantKey,
      amountCents: c.amountCents,
      cycle: liteToCycle(c.cycle),
      nextRenewalAt: c.nextRenewalAt ? parsePlainDate(c.nextRenewalAt) : null,
      confidence: c.confidence,
      status: ContractStatus.CANDIDATE,
      detectedFromTransactionIds: c.transactionIds,
    }));

    const result = await this.repo.replaceCandidates(ctx.householdId, data);
    return { created: result.created, replaced: result.deleted };
  }

  toResponse(c: Contract) {
    return {
      id: c.id,
      householdId: c.householdId,
      name: c.name,
      merchant: c.merchant,
      categoryId: c.categoryId,
      amountCents: c.amountCents,
      cycle: c.cycle,
      nextRenewalAt: c.nextRenewalAt ? c.nextRenewalAt.toISOString().slice(0, 10) : null,
      cancelByAt: c.cancelByAt ? c.cancelByAt.toISOString().slice(0, 10) : null,
      confidence: c.confidence,
      status: c.status,
      detectedFromTransactionIds: c.detectedFromTransactionIds,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    };
  }

  private validate(input: CreateContractInput): void {
    if (!input.name?.trim()) {
      throw new BadRequestException('Name ist erforderlich');
    }
    if (!Number.isInteger(input.amountCents)) {
      throw new BadRequestException('amountCents muss eine Ganzzahl sein');
    }
    if (!input.cycle || !Object.values(ContractCycle).includes(input.cycle)) {
      throw new BadRequestException('Ungültiger cycle');
    }
  }
}
