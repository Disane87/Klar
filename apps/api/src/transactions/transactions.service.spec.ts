import { describe, it, expect, vi } from 'vitest';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { Visibility } from '@prisma/client';
import { TransactionsService } from './transactions.service';
import type { TransactionsRepository, TransactionWithSplits } from './transactions.repository';
import type { RequestContext } from '../common/types/request-context.type';

const ctx: RequestContext = { userId: 'u1', householdId: 'hh1', source: 'web' };

const makeTx = (overrides: Partial<TransactionWithSplits> = {}): TransactionWithSplits => ({
  id: 'tx-1',
  householdId: 'hh1',
  createdByUserId: 'u1',
  amountCents: -5000,
  plannedAmountCents: null,
  isPlanned: false,
  categoryId: 'cat-1',
  projectId: null,
  date: new Date('2026-04-01'),
  description: 'Test',
  visibility: Visibility.SHARED,
  recurringTransactionId: null,
  externalRef: null,
  externalHash: null,
  counterparty: null,
  sourceImportId: null,
  color: null,
  icon: null,
  createdAt: new Date('2026-04-01'),
  updatedAt: new Date('2026-04-01'),
  splits: [],
  ...overrides,
});

function buildService() {
  const repo = {
    findAll: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  } as unknown as TransactionsRepository;
  const service = new TransactionsService(repo);
  return { service, repo };
}

describe('TransactionsService', () => {
  describe('list', () => {
    it('delegates to repo with householdId and userId', async () => {
      const { service, repo } = buildService();
      vi.mocked(repo.findAll).mockResolvedValue([]);
      await service.list(ctx);
      expect(repo.findAll).toHaveBeenCalledWith('hh1', { userId: 'u1' });
    });

    it('passes month filter when provided', async () => {
      const { service, repo } = buildService();
      vi.mocked(repo.findAll).mockResolvedValue([]);
      await service.list(ctx, { month: '2026-04' });
      expect(repo.findAll).toHaveBeenCalledWith('hh1', { month: '2026-04', userId: 'u1' });
    });
  });

  describe('create', () => {
    it('throws BadRequestException when amountCents is a float', async () => {
      const { service } = buildService();
      await expect(
        service.create(ctx, { amountCents: 9.99, categoryId: 'cat-1', date: '2026-04-01' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates transaction with correct defaults', async () => {
      const { service, repo } = buildService();
      vi.mocked(repo.create).mockResolvedValue(makeTx());
      await service.create(ctx, { amountCents: -5000, categoryId: 'cat-1', date: '2026-04-01' });
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amountCents: -5000,
          householdId: 'hh1',
          createdByUserId: 'u1',
          visibility: Visibility.SHARED,
          projectId: null,
          description: null,
          recurringTransactionId: null,
        }),
      );
    });

    it('parses date string to Date object', async () => {
      const { service, repo } = buildService();
      vi.mocked(repo.create).mockResolvedValue(makeTx());
      await service.create(ctx, { amountCents: -5000, categoryId: 'cat-1', date: '2026-04-15' });
      const call = vi.mocked(repo.create).mock.calls[0][0];
      expect(call.date).toBeInstanceOf(Date);
    });

    it('accepts positive amountCents for income', async () => {
      const { service, repo } = buildService();
      vi.mocked(repo.create).mockResolvedValue(makeTx({ amountCents: 300000 }));
      const result = await service.create(ctx, {
        amountCents: 300000,
        categoryId: 'cat-1',
        date: '2026-04-01',
      });
      expect(result.amountCents).toBe(300000);
    });
  });

  describe('update', () => {
    it('throws NotFoundException when not found', async () => {
      const { service, repo } = buildService();
      vi.mocked(repo.findById).mockResolvedValue(null);
      await expect(service.update(ctx, 'tx-99', { amountCents: -1000 })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException for PRIVATE transaction of another user', async () => {
      const { service, repo } = buildService();
      vi.mocked(repo.findById).mockResolvedValue(
        makeTx({ visibility: Visibility.PRIVATE, createdByUserId: 'other' }),
      );
      await expect(service.update(ctx, 'tx-1', { description: 'x' })).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('allows updating own PRIVATE transaction', async () => {
      const { service, repo } = buildService();
      vi.mocked(repo.findById).mockResolvedValue(
        makeTx({ visibility: Visibility.PRIVATE, createdByUserId: 'u1' }),
      );
      vi.mocked(repo.update).mockResolvedValue(makeTx({ description: 'Updated' }));
      const result = await service.update(ctx, 'tx-1', { description: 'Updated' });
      expect(result.description).toBe('Updated');
    });

    it('throws BadRequestException for float amountCents in update', async () => {
      const { service, repo } = buildService();
      vi.mocked(repo.findById).mockResolvedValue(makeTx());
      await expect(service.update(ctx, 'tx-1', { amountCents: 3.14 })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('updates and returns the transaction', async () => {
      const { service, repo } = buildService();
      vi.mocked(repo.findById).mockResolvedValue(makeTx());
      vi.mocked(repo.update).mockResolvedValue(makeTx({ description: 'Updated' }));
      const result = await service.update(ctx, 'tx-1', { description: 'Updated' });
      expect(result.description).toBe('Updated');
    });
  });

  describe('remove', () => {
    it('throws NotFoundException when not found', async () => {
      const { service, repo } = buildService();
      vi.mocked(repo.findById).mockResolvedValue(null);
      await expect(service.remove(ctx, 'tx-99')).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException for PRIVATE transaction of another user', async () => {
      const { service, repo } = buildService();
      vi.mocked(repo.findById).mockResolvedValue(
        makeTx({ visibility: Visibility.PRIVATE, createdByUserId: 'other' }),
      );
      await expect(service.remove(ctx, 'tx-1')).rejects.toThrow(ForbiddenException);
    });

    it('deletes when found and authorized', async () => {
      const { service, repo } = buildService();
      vi.mocked(repo.findById).mockResolvedValue(makeTx());
      vi.mocked(repo.delete).mockResolvedValue(makeTx());
      await service.remove(ctx, 'tx-1');
      expect(repo.delete).toHaveBeenCalledWith('tx-1');
    });
  });

  describe('toResponse', () => {
    it('serializes date to YYYY-MM-DD string', () => {
      const { service } = buildService();
      const result = service.toResponse(makeTx());
      expect(result.date).toBe('2026-04-01');
    });

    it('includes all required fields', () => {
      const { service } = buildService();
      const result = service.toResponse(makeTx());
      expect(result).toMatchObject({
        id: 'tx-1',
        householdId: 'hh1',
        amountCents: -5000,
        categoryId: 'cat-1',
        visibility: Visibility.SHARED,
      });
    });
  });
});
