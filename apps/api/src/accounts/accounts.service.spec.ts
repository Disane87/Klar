import { describe, it, expect, vi } from 'vitest';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { Account } from '@prisma/client';
import { AccountsService } from './accounts.service';
import type { AccountsRepository } from './accounts.repository';
import type { RequestContext } from '../common/types/request-context.type';

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
  syncEnabled: true,
  fintsConnectionId: null,
  fintsAccountRef: null,
  lastKnownBalanceCents: null,
  lastBalanceAt: null,
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
    update: vi.fn(),
    purgeTransactionsForAccount: vi.fn(),
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

  describe('update', () => {
    const ctxFor = (userId: string, householdId: string): RequestContext => ({
      userId,
      householdId,
      source: 'web',
    });

    it('renames a csv_only account for any household member (non-owner)', async () => {
      const { service, repo } = buildService();
      const existing = makeAccount({ id: 'acc-1', type: 'csv_only', ownerId: 'owner-x' });
      vi.mocked(repo.findById).mockResolvedValue(existing);
      vi.mocked(repo.update).mockResolvedValue({ ...existing, name: 'Neu' });
      const result = await service.update(ctxFor('user-other', 'hh1'), 'acc-1', { name: 'Neu' });
      expect(result.name).toBe('Neu');
      expect(repo.update).toHaveBeenCalledWith('acc-1', 'hh1', { name: 'Neu' });
    });

    it('rejects FinTS-account edits from non-owner with ForbiddenException', async () => {
      const { service, repo } = buildService();
      vi.mocked(repo.findById).mockResolvedValue(
        makeAccount({ id: 'acc-1', type: 'fints', ownerId: 'owner-1' }),
      );
      const promise = service.update(ctxFor('user-other', 'hh1'), 'acc-1', { name: 'X' });
      await expect(promise).rejects.toThrow(ForbiddenException);
      await expect(promise).rejects.toThrow(/Inhaber/);
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('allows FinTS owner to flip visibility', async () => {
      const { service, repo } = buildService();
      const existing = makeAccount({
        id: 'acc-1',
        type: 'fints',
        ownerId: 'owner-1',
        visibility: 'SHARED',
      });
      vi.mocked(repo.findById).mockResolvedValue(existing);
      vi.mocked(repo.update).mockResolvedValue({ ...existing, visibility: 'PRIVATE' });
      const result = await service.update(ctxFor('owner-1', 'hh1'), 'acc-1', {
        visibility: 'PRIVATE',
      });
      expect(result.visibility).toBe('PRIVATE');
      expect(repo.update).toHaveBeenCalledWith('acc-1', 'hh1', { visibility: 'PRIVATE' });
    });

    it('throws NotFoundException when account is not found (cross-tenant)', async () => {
      const { service, repo } = buildService();
      vi.mocked(repo.findById).mockResolvedValue(null);
      await expect(
        service.update(ctxFor('user-1', 'hh-other'), 'acc-1', { name: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('converts archivedAt ISO string to Date and forwards null', async () => {
      const { service, repo } = buildService();
      const existing = makeAccount({ id: 'acc-1', type: 'csv_only' });
      vi.mocked(repo.findById).mockResolvedValue(existing);
      vi.mocked(repo.update).mockResolvedValue(existing);
      const iso = new Date('2026-06-01T12:00:00.000Z').toISOString();
      await service.update(ctxFor('u1', 'hh1'), 'acc-1', { archivedAt: iso });
      const firstCall = vi.mocked(repo.update).mock.calls[0]!;
      expect(firstCall[2].archivedAt).toBeInstanceOf(Date);
      expect((firstCall[2].archivedAt as Date).toISOString()).toBe(iso);

      vi.mocked(repo.update).mockClear();
      await service.update(ctxFor('u1', 'hh1'), 'acc-1', { archivedAt: null });
      expect(vi.mocked(repo.update).mock.calls[0]![2]).toEqual({ archivedAt: null });
    });

    it('rejects empty or oversized name with BadRequestException', async () => {
      const { service, repo } = buildService();
      vi.mocked(repo.findById).mockResolvedValue(makeAccount({ id: 'acc-1', type: 'csv_only' }));
      await expect(
        service.update(ctxFor('u1', 'hh1'), 'acc-1', { name: '   ' }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.update(ctxFor('u1', 'hh1'), 'acc-1', { name: 'a'.repeat(101) }),
      ).rejects.toThrow(BadRequestException);
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('rejects invalid visibility with BadRequestException', async () => {
      const { service, repo } = buildService();
      vi.mocked(repo.findById).mockResolvedValue(makeAccount({ id: 'acc-1', type: 'csv_only' }));
      await expect(
        service.update(ctxFor('u1', 'hh1'), 'acc-1', {
          visibility: 'BOGUS' as 'SHARED',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('forwards syncEnabled toggle for FinTS owner', async () => {
      const { service, repo } = buildService();
      const existing = makeAccount({
        id: 'acc-1',
        type: 'fints',
        ownerId: 'owner-1',
        syncEnabled: true,
      });
      vi.mocked(repo.findById).mockResolvedValue(existing);
      vi.mocked(repo.update).mockResolvedValue({ ...existing, syncEnabled: false });
      const result = await service.update(ctxFor('owner-1', 'hh1'), 'acc-1', {
        syncEnabled: false,
      });
      expect(result.syncEnabled).toBe(false);
      expect(repo.update).toHaveBeenCalledWith('acc-1', 'hh1', { syncEnabled: false });
    });

    it('rejects syncEnabled toggle from FinTS non-owner', async () => {
      const { service, repo } = buildService();
      vi.mocked(repo.findById).mockResolvedValue(
        makeAccount({ id: 'acc-1', type: 'fints', ownerId: 'owner-1' }),
      );
      await expect(
        service.update(ctxFor('user-other', 'hh1'), 'acc-1', { syncEnabled: false }),
      ).rejects.toThrow(ForbiddenException);
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when repo.update returns null (race)', async () => {
      const { service, repo } = buildService();
      vi.mocked(repo.findById).mockResolvedValue(makeAccount({ id: 'acc-1', type: 'csv_only' }));
      vi.mocked(repo.update).mockResolvedValue(null);
      await expect(
        service.update(ctxFor('u1', 'hh1'), 'acc-1', { name: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('purgeTransactions', () => {
    const ctx: RequestContext = { userId: 'owner-1', householdId: 'hh1', source: 'web' };

    it('forwards the purge for a csv_only account regardless of caller', async () => {
      const { service, repo } = buildService();
      vi.mocked(repo.findById).mockResolvedValue(
        makeAccount({ id: 'acc-1', type: 'csv_only', ownerId: 'someone-else' }),
      );
      vi.mocked(repo.purgeTransactionsForAccount).mockResolvedValue({
        deletedTransactions: 7,
        deletedStandingOrders: 2,
      });
      const result = await service.purgeTransactions(ctx, 'acc-1');
      expect(result).toEqual({ deletedTransactions: 7, deletedStandingOrders: 2 });
      expect(repo.purgeTransactionsForAccount).toHaveBeenCalledWith('acc-1', 'hh1');
    });

    it('rejects FinTS purge from non-owner with ForbiddenException', async () => {
      const { service, repo } = buildService();
      vi.mocked(repo.findById).mockResolvedValue(
        makeAccount({ id: 'acc-1', type: 'fints', ownerId: 'someone-else' }),
      );
      await expect(service.purgeTransactions(ctx, 'acc-1')).rejects.toThrow(ForbiddenException);
      expect(repo.purgeTransactionsForAccount).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when account is missing', async () => {
      const { service, repo } = buildService();
      vi.mocked(repo.findById).mockResolvedValue(null);
      await expect(service.purgeTransactions(ctx, 'missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('toResponse', () => {
    it('serializes timestamps as ISO strings', () => {
      const { service } = buildService();
      const result = service.toResponse(makeAccount());
      expect(result.createdAt).toBe('2026-05-07T00:00:00.000Z');
      expect(result.archivedAt).toBeNull();
      expect(result.syncEnabled).toBe(true);
    });
  });
});
