import { Injectable } from '@nestjs/common';
import type { Contract, ContractCycle, ContractStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateContractData {
  householdId: string;
  name: string;
  merchant?: string | null;
  categoryId?: string | null;
  amountCents: number;
  cycle: ContractCycle;
  nextRenewalAt?: Date | null;
  cancelByAt?: Date | null;
  confidence?: number;
  status?: ContractStatus;
  detectedFromTransactionIds?: string[];
}

export interface UpdateContractData {
  name?: string;
  merchant?: string | null;
  categoryId?: string | null;
  amountCents?: number;
  cycle?: ContractCycle;
  nextRenewalAt?: Date | null;
  cancelByAt?: Date | null;
  confidence?: number;
  status?: ContractStatus;
}

export interface FindAllOpts {
  status?: ContractStatus;
}

@Injectable()
export class ContractsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll(householdId: string, opts: FindAllOpts = {}): Promise<Contract[]> {
    return this.prisma.contract.findMany({
      where: {
        householdId,
        ...(opts.status ? { status: opts.status } : {}),
      },
      orderBy: [{ status: 'asc' }, { nextRenewalAt: 'asc' }, { name: 'asc' }],
    });
  }

  findById(id: string, householdId: string): Promise<Contract | null> {
    return this.prisma.contract.findFirst({ where: { id, householdId } });
  }

  create(data: CreateContractData): Promise<Contract> {
    return this.prisma.contract.create({
      data: {
        householdId: data.householdId,
        name: data.name,
        merchant: data.merchant ?? null,
        categoryId: data.categoryId ?? null,
        amountCents: data.amountCents,
        cycle: data.cycle,
        nextRenewalAt: data.nextRenewalAt ?? null,
        cancelByAt: data.cancelByAt ?? null,
        confidence: data.confidence ?? 0,
        ...(data.status ? { status: data.status } : {}),
        detectedFromTransactionIds: data.detectedFromTransactionIds ?? [],
      },
    });
  }

  update(id: string, householdId: string, data: UpdateContractData): Promise<Contract> {
    const updateData: Prisma.ContractUpdateInput = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.merchant !== undefined) updateData.merchant = data.merchant;
    if (data.categoryId !== undefined) updateData.categoryId = data.categoryId;
    if (data.amountCents !== undefined) updateData.amountCents = data.amountCents;
    if (data.cycle !== undefined) updateData.cycle = data.cycle;
    if (data.nextRenewalAt !== undefined) updateData.nextRenewalAt = data.nextRenewalAt;
    if (data.cancelByAt !== undefined) updateData.cancelByAt = data.cancelByAt;
    if (data.confidence !== undefined) updateData.confidence = data.confidence;
    if (data.status !== undefined) updateData.status = data.status;
    return this.prisma.contract.update({
      where: { id, householdId } as unknown as Prisma.ContractWhereUniqueInput,
      data: updateData,
    });
  }

  async delete(id: string, householdId: string): Promise<void> {
    await this.prisma.contract.deleteMany({ where: { id, householdId } });
  }

  /** Returns ALL household transactions with merchant key + signed amount, used for detection. */
  async loadDetectionInput(householdId: string): Promise<
    Array<{ id: string; date: Date; amountCents: number; counterparty: string | null }>
  > {
    return this.prisma.transaction.findMany({
      where: { householdId },
      select: { id: true, date: true, amountCents: true, counterparty: true },
      orderBy: { date: 'asc' },
    });
  }

  /** Bulk-replace candidate contracts (status=CANDIDATE). Confirmed/Cancelled are preserved. */
  async replaceCandidates(
    householdId: string,
    candidates: CreateContractData[],
  ): Promise<{ deleted: number; created: number }> {
    return this.prisma.$transaction(async tx => {
      const deleted = await tx.contract.deleteMany({
        where: { householdId, status: 'CANDIDATE' },
      });
      let created = 0;
      for (const c of candidates) {
        await tx.contract.create({
          data: {
            householdId,
            name: c.name,
            merchant: c.merchant ?? null,
            categoryId: c.categoryId ?? null,
            amountCents: c.amountCents,
            cycle: c.cycle,
            nextRenewalAt: c.nextRenewalAt ?? null,
            cancelByAt: c.cancelByAt ?? null,
            confidence: c.confidence ?? 0,
            status: c.status ?? 'CANDIDATE',
            detectedFromTransactionIds: c.detectedFromTransactionIds ?? [],
          },
        });
        created++;
      }
      return { deleted: deleted.count, created };
    });
  }
}
