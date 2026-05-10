import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Account } from '@prisma/client';
import { AccountsRepository } from './accounts.repository';
import type { PrismaService } from '../prisma/prisma.service';

const makeAccount = (overrides: Partial<Account> = {}): Account => ({
  id: 'acc-1',
  householdId: 'hh1',
  ownerId: null,
  name: 'Hauptkonto',
  type: 'csv_only',
  currency: 'EUR',
  iban: null,
  bic: null,
  visibility: 'SHARED',
  archivedAt: null,
  fintsConnectionId: null,
  fintsAccountRef: null,
  lastKnownBalanceCents: null,
  lastBalanceAt: null,
  createdAt: new Date('2026-05-07'),
  updatedAt: new Date('2026-05-07'),
  ...overrides,
});

function buildRepo() {
  const prisma = {
    account: {
      updateMany: vi.fn(),
      findUnique: vi.fn(),
    },
  } as unknown as PrismaService;
  const repo = new AccountsRepository(prisma);
  return { repo, prisma };
}

describe('AccountsRepository.update', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the updated row on happy path', async () => {
    const { repo, prisma } = buildRepo();
    const updated = makeAccount({ name: 'Renamed' });
    vi.mocked(prisma.account.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.account.findUnique).mockResolvedValue(updated);

    const result = await repo.update('acc-1', 'hh1', { name: 'Renamed' });

    expect(result).toEqual(updated);
    expect(prisma.account.updateMany).toHaveBeenCalledWith({
      where: { id: 'acc-1', householdId: 'hh1' },
      data: { name: 'Renamed' },
    });
    expect(prisma.account.findUnique).toHaveBeenCalledWith({ where: { id: 'acc-1' } });
  });

  it('returns null without calling findUnique when count is 0', async () => {
    const { repo, prisma } = buildRepo();
    vi.mocked(prisma.account.updateMany).mockResolvedValue({ count: 0 });

    const result = await repo.update('acc-1', 'hh-other', { name: 'Hack' });

    expect(result).toBeNull();
    expect(prisma.account.findUnique).not.toHaveBeenCalled();
  });

  it('scopes updateMany by id and householdId to prevent cross-tenant writes', async () => {
    const { repo, prisma } = buildRepo();
    vi.mocked(prisma.account.updateMany).mockResolvedValue({ count: 0 });

    await repo.update('acc-foreign', 'hh-mine', { archivedAt: new Date('2026-05-10') });

    const call = vi.mocked(prisma.account.updateMany).mock.calls[0][0];
    expect(call.where).toEqual({ id: 'acc-foreign', householdId: 'hh-mine' });
    expect(call.data).toEqual({ archivedAt: new Date('2026-05-10') });
  });
});
