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
}
