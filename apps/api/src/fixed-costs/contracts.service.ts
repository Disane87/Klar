import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import type { Contract } from '@prisma/client';
import type { RequestContext } from '../common/types/request-context.type';
import { FixedCostsRepository } from './fixed-costs.repository';
import { ContractsRepository, type ContractData } from './contracts.repository';

export interface PromoteToContractInput {
  cancelByAt?: string | null;
  contractStartedAt?: string | null;
  contractHolder?: string | null;
  contractNumber?: string | null;
  providerName?: string | null;
  documentUrl?: string | null;
  notes?: string | null;
}

export type UpdateContractInput = Partial<PromoteToContractInput>;

function parsePlainDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function parsePlainDateOptional(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  return parsePlainDate(iso);
}

/**
 * Manages the 1:1 Contract extension on top of FixedCost. A FixedCost
 * becomes a Contract when the user wants to track contract-specific
 * metadata (cancellation deadline, provider, contract number, document).
 *
 * Concept: every Contract IS a FixedCost; not every FixedCost is a Contract.
 */
@Injectable()
export class ContractsService {
  constructor(
    private readonly contracts: ContractsRepository,
    private readonly fixedCosts: FixedCostsRepository,
  ) {}

  /**
   * Promote a FixedCost into a Contract by attaching the extension row.
   * Idempotent: calling on an already-promoted FixedCost throws Conflict.
   */
  async promote(
    ctx: RequestContext,
    fixedCostId: string,
    input: PromoteToContractInput,
  ): Promise<Contract> {
    const fc = await this.fixedCosts.findById(fixedCostId, ctx.householdId);
    if (!fc) {
      throw new NotFoundException(`Fixkosten-Eintrag ${fixedCostId} nicht gefunden`);
    }
    if (fc.contract) {
      throw new ConflictException(
        `Fixkosten-Eintrag ${fixedCostId} ist bereits ein Vertrag`,
      );
    }
    const data = this.toContractData(input);
    return this.contracts.create(fixedCostId, data);
  }

  async update(
    ctx: RequestContext,
    fixedCostId: string,
    input: UpdateContractInput,
  ): Promise<Contract> {
    const fc = await this.fixedCosts.findById(fixedCostId, ctx.householdId);
    if (!fc) {
      throw new NotFoundException(`Fixkosten-Eintrag ${fixedCostId} nicht gefunden`);
    }
    if (!fc.contract) {
      throw new NotFoundException(
        `Vertrag-Erweiterung für ${fixedCostId} existiert nicht`,
      );
    }
    const data = this.toContractData(input);
    return this.contracts.update(fc.contract.id, data);
  }

  /**
   * Remove the Contract extension. The underlying FixedCost stays — it just
   * loses its "contract" classification.
   */
  async demote(ctx: RequestContext, fixedCostId: string): Promise<void> {
    const fc = await this.fixedCosts.findById(fixedCostId, ctx.householdId);
    if (!fc) {
      throw new NotFoundException(`Fixkosten-Eintrag ${fixedCostId} nicht gefunden`);
    }
    if (!fc.contract) return; // idempotent
    await this.contracts.delete(fc.contract.id);
  }

  private toContractData(input: PromoteToContractInput): ContractData {
    if (input.cancelByAt && input.contractStartedAt) {
      const cancel = parsePlainDate(input.cancelByAt);
      const start = parsePlainDate(input.contractStartedAt);
      if (cancel < start) {
        throw new BadRequestException(
          'cancelByAt darf nicht vor contractStartedAt liegen',
        );
      }
    }
    return {
      cancelByAt: parsePlainDateOptional(input.cancelByAt),
      contractStartedAt: parsePlainDateOptional(input.contractStartedAt),
      contractHolder: input.contractHolder ?? null,
      contractNumber: input.contractNumber ?? null,
      providerName: input.providerName ?? null,
      documentUrl: input.documentUrl ?? null,
      notes: input.notes ?? null,
    };
  }
}
