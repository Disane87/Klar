import { Injectable } from '@nestjs/common';
import type { Contract, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface ContractData {
  cancelByAt?: Date | null;
  contractStartedAt?: Date | null;
  contractHolder?: string | null;
  contractNumber?: string | null;
  providerName?: string | null;
  documentUrl?: string | null;
  notes?: string | null;
}

@Injectable()
export class ContractsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(fixedCostId: string, data: ContractData): Promise<Contract> {
    return this.prisma.contract.create({
      data: {
        fixedCostId,
        cancelByAt: data.cancelByAt ?? null,
        contractStartedAt: data.contractStartedAt ?? null,
        contractHolder: data.contractHolder ?? null,
        contractNumber: data.contractNumber ?? null,
        providerName: data.providerName ?? null,
        documentUrl: data.documentUrl ?? null,
        notes: data.notes ?? null,
      },
    });
  }

  update(id: string, data: ContractData): Promise<Contract> {
    const update: Prisma.ContractUpdateInput = {};
    if (data.cancelByAt !== undefined) update.cancelByAt = data.cancelByAt;
    if (data.contractStartedAt !== undefined)
      update.contractStartedAt = data.contractStartedAt;
    if (data.contractHolder !== undefined)
      update.contractHolder = data.contractHolder;
    if (data.contractNumber !== undefined)
      update.contractNumber = data.contractNumber;
    if (data.providerName !== undefined) update.providerName = data.providerName;
    if (data.documentUrl !== undefined) update.documentUrl = data.documentUrl;
    if (data.notes !== undefined) update.notes = data.notes;
    return this.prisma.contract.update({ where: { id }, data: update });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.contract.delete({ where: { id } });
  }
}
