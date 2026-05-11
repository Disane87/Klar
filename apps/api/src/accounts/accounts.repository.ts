import { Injectable } from '@nestjs/common';
import type { Account, AccountType, Visibility } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateAccountData {
  householdId: string;
  ownerId?: string | null;
  name: string;
  type: AccountType;
  currency?: string;
  iban?: string | null;
  bic?: string | null;
  visibility?: Visibility;
}

export interface UpdateAccountData {
  name?: string;
  visibility?: Visibility;
  archivedAt?: Date | null;
  syncEnabled?: boolean;
}

@Injectable()
export class AccountsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAllForHousehold(householdId: string): Promise<Account[]> {
    return this.prisma.account.findMany({
      where: { householdId, archivedAt: null },
      orderBy: [{ type: 'asc' }, { createdAt: 'asc' }],
    });
  }

  findById(id: string, householdId: string): Promise<Account | null> {
    return this.prisma.account.findFirst({ where: { id, householdId } });
  }

  /** Returns the household's first non-archived csv_only account, if any. */
  findDefaultCsvAccount(householdId: string): Promise<Account | null> {
    return this.prisma.account.findFirst({
      where: { householdId, type: 'csv_only', archivedAt: null },
      orderBy: { createdAt: 'asc' },
    });
  }

  create(data: CreateAccountData): Promise<Account> {
    return this.prisma.account.create({ data });
  }

  async update(
    id: string,
    householdId: string,
    data: UpdateAccountData,
  ): Promise<Account | null> {
    const result = await this.prisma.account.updateMany({
      where: { id, householdId },
      data,
    });
    if (result.count === 0) {
      return null;
    }
    return this.prisma.account.findUnique({ where: { id } });
  }
}
