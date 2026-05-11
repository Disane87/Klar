import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Account } from '@prisma/client';
import { AccountsRepository, type UpdateAccountData } from './accounts.repository';
import type { RequestContext } from '../common/types/request-context.type';

export interface UpdateAccountInput {
  name?: string;
  visibility?: 'SHARED' | 'PRIVATE';
  archivedAt?: string | null;
  syncEnabled?: boolean;
}

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

  async update(
    ctx: RequestContext,
    id: string,
    patch: UpdateAccountInput,
  ): Promise<Account> {
    const existing = await this.findById(id, ctx.householdId);

    if (existing.type === 'fints' && existing.ownerId !== ctx.userId) {
      throw new ForbiddenException(
        'Nur der Inhaber dieses FinTS-Kontos darf es ändern.',
      );
    }

    const data: UpdateAccountData = {};

    if (patch.name !== undefined) {
      const trimmed = patch.name.trim();
      if (trimmed.length < 1 || trimmed.length > 100) {
        throw new BadRequestException('name muss 1..100 Zeichen lang sein');
      }
      data.name = trimmed;
    }

    if (patch.visibility !== undefined) {
      if (patch.visibility !== 'SHARED' && patch.visibility !== 'PRIVATE') {
        throw new BadRequestException('Ungültige visibility');
      }
      data.visibility = patch.visibility;
    }

    if (patch.archivedAt !== undefined) {
      data.archivedAt = patch.archivedAt === null ? null : new Date(patch.archivedAt);
    }

    if (patch.syncEnabled !== undefined) {
      data.syncEnabled = patch.syncEnabled;
    }

    const updated = await this.repo.update(id, ctx.householdId, data);
    if (!updated) {
      throw new NotFoundException(`Account ${id} nicht gefunden`);
    }
    return updated;
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
      syncEnabled: account.syncEnabled,
      createdAt: account.createdAt.toISOString(),
      updatedAt: account.updatedAt.toISOString(),
    };
  }
}
