import { describe, it, expect, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import type { Account } from '@prisma/client';
import { AccountsService } from './accounts.service';
import type { AccountsRepository } from './accounts.repository';

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
  createdAt: new Date('2026-05-07'),
  updatedAt: new Date('2026-05-07'),
  ...overrides,
});

function buildService() {
  const repo = {
    findAllForHousehold: vi.fn(),
    findById: vi.fn(),
    findDefaultCsvAccount: vi.fn(),
    create: vi.fn(),
  } as unknown as AccountsRepository;
  const service = new AccountsService(repo);
  return { service, repo };
}

describe('AccountsService', () => {
  describe('ensureDefaultAccountId', () => {
    it('returns existing default account id when present', async () => {
      const { service, repo } = buildService();
      vi.mocked(repo.findDefaultCsvAccount).mockResolvedValue(makeAccount({ id: 'acc-existing' }));
      const id = await service.ensureDefaultAccountId('hh1');
      expect(id).toBe('acc-existing');
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('creates a new csv_only account when none exists', async () => {
      const { service, repo } = buildService();
      vi.mocked(repo.findDefaultCsvAccount).mockResolvedValue(null);
      vi.mocked(repo.create).mockResolvedValue(makeAccount({ id: 'acc-new' }));
      const id = await service.ensureDefaultAccountId('hh1');
      expect(id).toBe('acc-new');
      expect(repo.create).toHaveBeenCalledWith({
        householdId: 'hh1',
        name: 'Hauptkonto',
        type: 'csv_only',
      });
    });
  });

  describe('findById', () => {
    it('returns account when found', async () => {
      const { service, repo } = buildService();
      vi.mocked(repo.findById).mockResolvedValue(makeAccount());
      const result = await service.findById('acc-1', 'hh1');
      expect(result.id).toBe('acc-1');
    });

    it('throws NotFoundException when account does not exist', async () => {
      const { service, repo } = buildService();
      vi.mocked(repo.findById).mockResolvedValue(null);
      await expect(service.findById('missing', 'hh1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('list', () => {
    it('delegates to repo', async () => {
      const { service, repo } = buildService();
      vi.mocked(repo.findAllForHousehold).mockResolvedValue([makeAccount()]);
      const result = await service.list('hh1');
      expect(result).toHaveLength(1);
      expect(repo.findAllForHousehold).toHaveBeenCalledWith('hh1');
    });
  });

  describe('toResponse', () => {
    it('serializes timestamps as ISO strings', () => {
      const { service } = buildService();
      const result = service.toResponse(makeAccount());
      expect(result.createdAt).toBe('2026-05-07T00:00:00.000Z');
      expect(result.archivedAt).toBeNull();
    });
  });
});
