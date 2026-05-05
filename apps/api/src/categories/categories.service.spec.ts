import { describe, it, expect, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { CategoryType } from '@prisma/client';
import { CategoriesService } from './categories.service';
import type { CategoriesRepository } from './categories.repository';
import type { Category } from '@prisma/client';
import type { RequestContext } from '../common/types/request-context.type';

const ctx: RequestContext = { userId: 'u1', householdId: 'hh1', source: 'web' };

const makeCategory = (overrides: Partial<Category> = {}): Category => ({
  id: 'cat-1',
  householdId: 'hh1',
  name: 'Wohnen',
  type: CategoryType.EXPENSE,
  color: '#60a5fa',
  icon: 'home',
  isArchived: false,
  sortOrder: 10,
  isDefault: false,
  createdAt: new Date('2026-01-01'),
  ...overrides,
});

function buildService() {
  const repo = {
    findAll: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    hasTransactions: vi.fn(),
  } as unknown as CategoriesRepository;
  const service = new CategoriesService(repo);
  return { service, repo };
}

describe('CategoriesService', () => {
  describe('list', () => {
    it('delegates to repo.findAll with householdId', async () => {
      const { service, repo } = buildService();
      vi.mocked(repo.findAll).mockResolvedValue([]);
      await service.list(ctx);
      expect(repo.findAll).toHaveBeenCalledWith('hh1', {});
    });

    it('passes filter options to repo', async () => {
      const { service, repo } = buildService();
      vi.mocked(repo.findAll).mockResolvedValue([]);
      await service.list(ctx, { type: CategoryType.EXPENSE, includeArchived: true });
      expect(repo.findAll).toHaveBeenCalledWith('hh1', {
        type: CategoryType.EXPENSE,
        includeArchived: true,
      });
    });
  });

  describe('create', () => {
    it('creates a category with trimmed name', async () => {
      const { service, repo } = buildService();
      const cat = makeCategory();
      vi.mocked(repo.create).mockResolvedValue(cat);
      const result = await service.create(ctx, {
        name: '  Wohnen  ',
        type: CategoryType.EXPENSE,
        color: '#60a5fa',
      });
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Wohnen', isDefault: false }),
      );
      expect(result).toBe(cat);
    });

    it('uses sortOrder 0 when not provided', async () => {
      const { service, repo } = buildService();
      vi.mocked(repo.create).mockResolvedValue(makeCategory());
      await service.create(ctx, { name: 'Test', type: CategoryType.EXPENSE, color: '#fff' });
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ sortOrder: 0 }),
      );
    });
  });

  describe('update', () => {
    it('throws NotFoundException when category not found', async () => {
      const { service, repo } = buildService();
      vi.mocked(repo.findById).mockResolvedValue(null);
      await expect(service.update(ctx, 'cat-99', { name: 'x' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('updates and returns the category', async () => {
      const { service, repo } = buildService();
      const cat = makeCategory();
      vi.mocked(repo.findById).mockResolvedValue(cat);
      vi.mocked(repo.update).mockResolvedValue({ ...cat, name: 'Miete' });
      const result = await service.update(ctx, 'cat-1', { name: 'Miete' });
      expect(result.name).toBe('Miete');
    });

    it('trims the updated name', async () => {
      const { service, repo } = buildService();
      vi.mocked(repo.findById).mockResolvedValue(makeCategory());
      vi.mocked(repo.update).mockResolvedValue(makeCategory({ name: 'Neu' }));
      await service.update(ctx, 'cat-1', { name: '  Neu  ' });
      expect(repo.update).toHaveBeenCalledWith(
        'cat-1',
        'hh1',
        expect.objectContaining({ name: 'Neu' }),
      );
    });
  });

  describe('remove', () => {
    it('throws NotFoundException when category not found', async () => {
      const { service, repo } = buildService();
      vi.mocked(repo.findById).mockResolvedValue(null);
      await expect(service.remove(ctx, 'cat-99')).rejects.toThrow(NotFoundException);
    });

    it('hard-deletes when no transactions exist', async () => {
      const { service, repo } = buildService();
      vi.mocked(repo.findById).mockResolvedValue(makeCategory());
      vi.mocked(repo.hasTransactions).mockResolvedValue(false);
      vi.mocked(repo.delete).mockResolvedValue(makeCategory());
      await service.remove(ctx, 'cat-1');
      expect(repo.delete).toHaveBeenCalledWith('cat-1');
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('archives (soft-delete) when transactions exist', async () => {
      const { service, repo } = buildService();
      vi.mocked(repo.findById).mockResolvedValue(makeCategory());
      vi.mocked(repo.hasTransactions).mockResolvedValue(true);
      vi.mocked(repo.update).mockResolvedValue(makeCategory({ isArchived: true }));
      await service.remove(ctx, 'cat-1');
      expect(repo.update).toHaveBeenCalledWith('cat-1', 'hh1', { isArchived: true });
      expect(repo.delete).not.toHaveBeenCalled();
    });
  });

  describe('seedDefaults', () => {
    it('calls createMany with 11 default categories for the household', async () => {
      const { service, repo } = buildService();
      vi.mocked(repo.createMany).mockResolvedValue({ count: 0 });
      await service.seedDefaults('hh1');
      const call = vi.mocked(repo.createMany).mock.calls[0][0];
      expect(call).toHaveLength(11);
      expect(call.every((c: { householdId: string }) => c.householdId === 'hh1')).toBe(true);
    });

    it('marks all seeded categories as isDefault = true', async () => {
      const { service, repo } = buildService();
      vi.mocked(repo.createMany).mockResolvedValue({ count: 0 });
      await service.seedDefaults('hh1');
      const call = vi.mocked(repo.createMany).mock.calls[0][0];
      expect(call.every((c: { isDefault?: boolean }) => c.isDefault === true)).toBe(true);
    });
  });

  describe('toResponse', () => {
    it('serializes createdAt to ISO string', () => {
      const { service } = buildService();
      const result = service.toResponse(makeCategory());
      expect(typeof result.createdAt).toBe('string');
      expect(result.createdAt).toContain('2026');
    });

    it('includes all required fields', () => {
      const { service } = buildService();
      const result = service.toResponse(makeCategory());
      expect(result).toMatchObject({
        id: 'cat-1',
        householdId: 'hh1',
        name: 'Wohnen',
        type: CategoryType.EXPENSE,
        color: '#60a5fa',
        isArchived: false,
        isDefault: false,
      });
    });
  });
});
