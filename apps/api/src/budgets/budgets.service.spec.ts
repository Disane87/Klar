import { describe, it, expect, vi } from 'vitest';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { BudgetsService } from './budgets.service';
import type { BudgetsRepository } from './budgets.repository';
import type { Budget } from '@prisma/client';
import type { RequestContext } from '../common/types/request-context.type';

const ctx: RequestContext = { userId: 'u1', householdId: 'hh1', source: 'web' };

const makeBudget = (overrides: Partial<Budget> = {}): Budget => ({
  id: 'bud-1',
  householdId: 'hh1',
  categoryId: 'cat-1',
  month: new Date('2026-04-01'),
  amountCents: 50000,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  ...overrides,
});

function buildService(): { service: BudgetsService; repo: BudgetsRepository } {
  const repo = {
    findAll: vi.fn(),
    findById: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
  } as unknown as BudgetsRepository;

  const service = new BudgetsService(repo);

  return { service, repo };
}

describe('BudgetsService', () => {
  describe('list', () => {
    it('delegates to repo.findAll with householdId', async () => {
      const { service, repo } = buildService();
      const budgets = [makeBudget()];
      vi.mocked(repo.findAll).mockResolvedValue(budgets);

      const result = await service.list(ctx);

      expect(repo.findAll).toHaveBeenCalledWith('hh1', {});
      expect(result).toBe(budgets);
    });

    it('passes opts to repo.findAll when provided', async () => {
      const { service, repo } = buildService();
      vi.mocked(repo.findAll).mockResolvedValue([]);

      await service.list(ctx, { month: '2026-04', categoryId: 'cat-1' });

      expect(repo.findAll).toHaveBeenCalledWith('hh1', {
        month: '2026-04',
        categoryId: 'cat-1',
      });
    });
  });

  describe('upsert', () => {
    it('throws BadRequestException when amountCents is 0', async () => {
      const { service } = buildService();

      await expect(
        service.upsert(ctx, { categoryId: 'cat-1', month: '2026-04', amountCents: 0 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when amountCents is negative', async () => {
      const { service } = buildService();

      await expect(
        service.upsert(ctx, { categoryId: 'cat-1', month: '2026-04', amountCents: -100 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when amountCents is a float', async () => {
      const { service } = buildService();

      await expect(
        service.upsert(ctx, { categoryId: 'cat-1', month: '2026-04', amountCents: 9.99 }),
      ).rejects.toThrow(BadRequestException);
    });

    it("normalizes 'YYYY-MM' to 'YYYY-MM-01' and calls repo.upsert", async () => {
      const { service, repo } = buildService();
      const budget = makeBudget();
      vi.mocked(repo.upsert).mockResolvedValue(budget);

      const result = await service.upsert(ctx, {
        categoryId: 'cat-1',
        month: '2026-04',
        amountCents: 50000,
      });

      expect(repo.upsert).toHaveBeenCalledWith('hh1', 'cat-1', '2026-04-01', 50000);
      expect(result).toBe(budget);
    });

    it("normalizes 'YYYY-MM-15' to 'YYYY-MM-01'", async () => {
      const { service, repo } = buildService();
      vi.mocked(repo.upsert).mockResolvedValue(makeBudget());

      await service.upsert(ctx, {
        categoryId: 'cat-1',
        month: '2026-04-15',
        amountCents: 50000,
      });

      expect(repo.upsert).toHaveBeenCalledWith('hh1', 'cat-1', '2026-04-01', 50000);
    });
  });

  describe('remove', () => {
    it('throws NotFoundException when budget not found', async () => {
      const { service, repo } = buildService();
      vi.mocked(repo.findById).mockResolvedValue(null);

      await expect(service.remove(ctx, 'bud-missing')).rejects.toThrow(NotFoundException);
    });

    it('calls repo.delete with id and householdId when found', async () => {
      const { service, repo } = buildService();
      const budget = makeBudget();
      vi.mocked(repo.findById).mockResolvedValue(budget);
      vi.mocked(repo.delete).mockResolvedValue(budget);

      await service.remove(ctx, 'bud-1');

      expect(repo.findById).toHaveBeenCalledWith('bud-1', 'hh1');
      expect(repo.delete).toHaveBeenCalledWith('bud-1', 'hh1');
    });
  });

  describe('toResponse', () => {
    it("serializes month Date to 'YYYY-MM-01' string", () => {
      const { service } = buildService();
      const budget = makeBudget({ month: new Date('2026-04-01T00:00:00.000Z') });

      const response = service.toResponse(budget);

      expect(response.month).toBe('2026-04-01');
    });

    it('serializes all Budget fields correctly', () => {
      const { service } = buildService();
      const budget = makeBudget();

      const response = service.toResponse(budget);

      expect(response.id).toBe('bud-1');
      expect(response.householdId).toBe('hh1');
      expect(response.categoryId).toBe('cat-1');
      expect(response.amountCents).toBe(50000);
      expect(response.createdAt).toBe(budget.createdAt.toISOString());
      expect(response.updatedAt).toBe(budget.updatedAt.toISOString());
    });
  });
});
