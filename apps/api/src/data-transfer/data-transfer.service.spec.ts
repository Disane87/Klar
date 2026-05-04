import { describe, it, expect, vi } from 'vitest';
import { BadRequestException, UnprocessableEntityException } from '@nestjs/common';
import { DataTransferService } from './data-transfer.service';
import type { DataTransferRepository } from './data-transfer.repository';
import type { RequestContext } from '../common/types/request-context.type';

const ctx: RequestContext = { userId: 'u1', householdId: 'hh1', source: 'web' };

const mockCat = (overrides = {}) => ({
  id: 'cat-1', householdId: 'hh1', name: 'Lebensmittel', type: 'EXPENSE',
  color: '#000', icon: null, isArchived: false, sortOrder: 0, isDefault: false,
  createdAt: new Date(), ...overrides,
});

function buildService() {
  const repo = {
    findTransactionsForExport: vi.fn().mockResolvedValue([]),
    findRecurringTransactionsForExport: vi.fn().mockResolvedValue([]),
    findCategoriesByNames: vi.fn().mockResolvedValue([]),
    findProjectsByNames: vi.fn().mockResolvedValue([]),
    findAllCategories: vi.fn().mockResolvedValue([]),
    findAllProjects: vi.fn().mockResolvedValue([]),
    findCategoryById: vi.fn().mockResolvedValue(null),
    findProjectById: vi.fn().mockResolvedValue(null),
    createTransaction: vi.fn(),
    createRecurringTransaction: vi.fn(),
  } as unknown as DataTransferRepository;
  return { service: new DataTransferService(repo), repo };
}

const validFile = JSON.stringify({
  version: '1',
  exportedAt: '2026-05-04T00:00:00Z',
  includes: ['transactions'],
  filters: { startDate: null, endDate: null },
  transactions: [
    {
      amountCents: -1500,
      date: '2025-04-15',
      description: 'Rewe',
      visibility: 'SHARED',
      category: { name: 'Lebensmittel', type: 'EXPENSE' },
      project: null,
    },
  ],
  recurringTransactions: [],
});

describe('DataTransferService', () => {
  describe('export', () => {
    it('calls repo with householdId and returns version 1 payload', async () => {
      const { service, repo } = buildService();
      vi.mocked(repo.findTransactionsForExport).mockResolvedValue([]);
      vi.mocked(repo.findRecurringTransactionsForExport).mockResolvedValue([]);
      const result = await service.export(ctx, { include: ['transactions', 'recurringTransactions'] });
      expect(result.version).toBe('1');
      expect(result.includes).toContain('transactions');
      expect(repo.findTransactionsForExport).toHaveBeenCalledWith('hh1', expect.any(Object));
    });

    it('maps transaction to export format without ids', async () => {
      const { service, repo } = buildService();
      vi.mocked(repo.findTransactionsForExport).mockResolvedValue([
        {
          id: 'tx-1', householdId: 'hh1', createdByUserId: 'u1',
          amountCents: -1500, date: new Date('2025-04-15'),
          description: 'Rewe', visibility: 'SHARED' as const,
          categoryId: 'cat-1', projectId: null, recurringTransactionId: null,
          createdAt: new Date(), updatedAt: new Date(),
          category: mockCat(), project: null,
        },
      ] as never);
      const result = await service.export(ctx, { include: ['transactions'] });
      const tx = result.transactions![0];
      expect('id' in tx).toBe(false);
      expect(tx.amountCents).toBe(-1500);
      expect(tx.category.name).toBe('Lebensmittel');
    });
  });

  describe('analyze', () => {
    it('throws BadRequestException for invalid JSON', async () => {
      const { service } = buildService();
      await expect(service.analyze(ctx, 'not-json')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException for wrong version', async () => {
      const { service } = buildService();
      const bad = JSON.stringify({ version: '2', exportedAt: '', includes: [], filters: {} });
      await expect(service.analyze(ctx, bad)).rejects.toThrow(BadRequestException);
    });

    it('returns resolvedId for matched category', async () => {
      const { service, repo } = buildService();
      vi.mocked(repo.findCategoriesByNames).mockResolvedValue([mockCat()]);
      vi.mocked(repo.findAllCategories).mockResolvedValue([mockCat()]);
      vi.mocked(repo.findAllProjects).mockResolvedValue([]);
      const result = await service.analyze(ctx, validFile);
      const catMap = result.categoryMappings.find(m => m.source.name === 'Lebensmittel');
      expect(catMap?.resolvedId).toBe('cat-1');
    });

    it('returns resolvedId null for unmatched category', async () => {
      const { service, repo } = buildService();
      vi.mocked(repo.findCategoriesByNames).mockResolvedValue([]);
      vi.mocked(repo.findAllCategories).mockResolvedValue([]);
      vi.mocked(repo.findAllProjects).mockResolvedValue([]);
      const result = await service.analyze(ctx, validFile);
      const catMap = result.categoryMappings.find(m => m.source.name === 'Lebensmittel');
      expect(catMap?.resolvedId).toBeNull();
    });
  });

  describe('confirm', () => {
    it('throws BadRequestException when a categoryMapping is missing for unresolved category', async () => {
      const { service, repo } = buildService();
      vi.mocked(repo.findCategoriesByNames).mockResolvedValue([]);
      await expect(
        service.confirm(ctx, validFile, { categoryMappings: [], projectMappings: [] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws UnprocessableEntityException when targetId not in household', async () => {
      const { service, repo } = buildService();
      vi.mocked(repo.findCategoriesByNames).mockResolvedValue([]);
      vi.mocked(repo.findCategoryById).mockResolvedValue(null);
      await expect(
        service.confirm(ctx, validFile, {
          categoryMappings: [{ sourceName: 'Lebensmittel', sourceType: 'EXPENSE', targetId: 'bad-id' }],
          projectMappings: [],
        }),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('calls createTransaction for each transaction when all resolved', async () => {
      const { service, repo } = buildService();
      vi.mocked(repo.findCategoriesByNames).mockResolvedValue([mockCat()]);
      vi.mocked(repo.findCategoryById).mockResolvedValue(mockCat());
      vi.mocked(repo.createTransaction).mockResolvedValue({} as never);
      const result = await service.confirm(ctx, validFile, { categoryMappings: [], projectMappings: [] });
      expect(repo.createTransaction).toHaveBeenCalledTimes(1);
      expect(result.imported.transactions).toBe(1);
      expect(result.skipped).toBe(0);
    });
  });
});
