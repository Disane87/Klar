import { Injectable, NotFoundException } from '@nestjs/common';
import type { Account } from '@prisma/client';
import { AccountsRepository } from './accounts.repository';

@Injectable()
export class AccountsService {
  constructor(private readonly repo: AccountsRepository) {}

  list(householdId: string): Promise<Account[]> {
    return this.repo.findAllForHousehold(householdId);
  }

  /**
   * Returns the household's default csv_only account, creating one lazily
   * if missing. Used by every Transaction-creating site that doesn't yet
   * carry an explicit account selection (CSV import, manual entry without
   * account picker). Idempotent.
   */
  async ensureDefaultAccountId(householdId: string): Promise<string> {
    const existing = await this.repo.findDefaultCsvAccount(householdId);
    if (existing) return existing.id;
    const created = await this.repo.create({
      householdId,
      name: 'Hauptkonto',
      type: 'csv_only',
    });
    return created.id;
  }

  async findById(id: string, householdId: string): Promise<Account> {
    const account = await this.repo.findById(id, householdId);
    if (!account) {
      throw new NotFoundException(`Account ${id} nicht gefunden`);
    }
    return account;
  }

  toResponse(account: Account) {
    return {
      id: account.id,
      householdId: account.householdId,
      ownerId: account.ownerId,
      name: account.name,
      type: account.type,
      currency: account.currency,
      iban: account.iban,
      bic: account.bic,
      visibility: account.visibility,
      archivedAt: account.archivedAt?.toISOString() ?? null,
      createdAt: account.createdAt.toISOString(),
      updatedAt: account.updatedAt.toISOString(),
    };
  }
}
