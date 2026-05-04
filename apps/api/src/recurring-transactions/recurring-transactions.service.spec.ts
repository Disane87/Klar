import { describe, it, expect, vi } from 'vitest';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { RecurringFrequency, Visibility } from '@prisma/client';
import { RecurringTransactionsService } from './recurring-transactions.service';
import type { RecurringTransactionsRepository } from './recurring-transactions.repository';
import type { RecurringTransaction } from '@prisma/client';
import type { RequestContext } from '../common/types/request-context.type';

const ctx: RequestContext = { userId: 'u1', householdId: 'hh1', source: 'web' };

const makeRt = (overrides: Partial<RecurringTransaction> = {}): RecurringTransaction => ({
  id: 'rt-1',
  householdId: 'hh1',
  createdByUserId: 'u1',
  name: 'Miete',
  color: null,
  icon: null,
  amountCents: -80000,
  categoryId: 'cat-1',
  projectId: null,
  frequency: RecurringFrequency.MONTHLY,
  customDays: null,
  dayOfMonth: 1,
  startDate: new Date('2026-01-01'),
  endDate: null,
  visibility: Visibility.SHARED,
  isVariable: false,
  note: null,
  isActive: true,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  ...overrides,
});

function buildService() {
  const repo = {
    findAll: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    setActive: vi.fn(),
  } as unknown as RecurringTransactionsRepository;
  const service = new RecurringTransactionsService(repo);
  return { service, repo };
}

describe('RecurringTransactionsService', () => {
  describe('create', () => {
    it('throws BadRequestException when amountCents is a float', async () => {
      const { service } = buildService();
      await expect(
        service.create(ctx, {
          name: 'Miete',
          amountCents: 9.99,
          categoryId: 'cat-1',
          frequency: RecurringFrequency.MONTHLY,
          startDate: '2026-01-01',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when CUSTOM_DAYS without customDays value', async () => {
      const { service } = buildService();
      await expect(
        service.create(ctx, {
          name: 'x',
          amountCents: -1000,
          categoryId: 'cat-1',
          frequency: RecurringFrequency.CUSTOM_DAYS,
          startDate: '2026-01-01',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when CUSTOM_DAYS with customDays = 0', async () => {
      const { service } = buildService();
      await expect(
        service.create(ctx, {
          name: 'x',
          amountCents: -1000,
          categoryId: 'cat-1',
          frequency: RecurringFrequency.CUSTOM_DAYS,
          startDate: '2026-01-01',
          customDays: 0,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when dayOfMonth > 31', async () => {
      const { service } = buildService();
      await expect(
        service.create(ctx, {
          name: 'x',
          amountCents: -1000,
          categoryId: 'cat-1',
          frequency: RecurringFrequency.MONTHLY,
          startDate: '2026-01-01',
          dayOfMonth: 32,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when dayOfMonth < 1', async () => {
      const { service } = buildService();
      await expect(
        service.create(ctx, {
          name: 'x',
          amountCents: -1000,
          categoryId: 'cat-1',
          frequency: RecurringFrequency.MONTHLY,
          startDate: '2026-01-01',
          dayOfMonth: 0,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates recurring transaction with valid MONTHLY input', async () => {
      const { service, repo } = buildService();
      vi.mocked(repo.create).mockResolvedValue(makeRt());
      const result = await service.create(ctx, {
        name: '  Miete  ',
        amountCents: -80000,
        categoryId: 'cat-1',
        frequency: RecurringFrequency.MONTHLY,
        startDate: '2026-01-01',
        dayOfMonth: 1,
      });
      expect(result.id).toBe('rt-1');
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Miete',
          householdId: 'hh1',
          createdByUserId: 'u1',
          isActive: true,
          visibility: Visibility.SHARED,
        }),
      );
    });

    it('accepts CUSTOM_DAYS with positive customDays', async () => {
      const { service, repo } = buildService();
      vi.mocked(repo.create).mockResolvedValue(makeRt({ frequency: RecurringFrequency.CUSTOM_DAYS, customDays: 14 }));
      await service.create(ctx, {
        name: 'Bi-weekly',
        amountCents: -10000,
        categoryId: 'cat-1',
        frequency: RecurringFrequency.CUSTOM_DAYS,
        startDate: '2026-01-01',
        customDays: 14,
      });
      expect(repo.create).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('throws NotFoundException when not found', async () => {
      const { service, repo } = buildService();
      vi.mocked(repo.findById).mockResolvedValue(null);
      await expect(service.update(ctx, 'rt-99', { name: 'x' })).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when updating PRIVATE entry of another user', async () => {
      const { service, repo } = buildService();
      vi.mocked(repo.findById).mockResolvedValue(
        makeRt({ visibility: Visibility.PRIVATE, createdByUserId: 'other' }),
      );
      await expect(service.update(ctx, 'rt-1', { name: 'x' })).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException for float amountCents in update', async () => {
      const { service, repo } = buildService();
      vi.mocked(repo.findById).mockResolvedValue(makeRt());
      await expect(service.update(ctx, 'rt-1', { amountCents: 9.99 })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('updates name and returns result', async () => {
      const { service, repo } = buildService();
      vi.mocked(repo.findById).mockResolvedValue(makeRt());
      vi.mocked(repo.update).mockResolvedValue(makeRt({ name: 'Updated Miete' }));
      const result = await service.update(ctx, 'rt-1', { name: 'Updated Miete' });
      expect(result.name).toBe('Updated Miete');
    });
  });

  describe('remove', () => {
    it('throws NotFoundException when not found', async () => {
      const { service, repo } = buildService();
      vi.mocked(repo.findById).mockResolvedValue(null);
      await expect(service.remove(ctx, 'rt-99')).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException for PRIVATE entry of another user', async () => {
      const { service, repo } = buildService();
      vi.mocked(repo.findById).mockResolvedValue(
        makeRt({ visibility: Visibility.PRIVATE, createdByUserId: 'other' }),
      );
      await expect(service.remove(ctx, 'rt-1')).rejects.toThrow(ForbiddenException);
    });

    it('deletes when found and authorized', async () => {
      const { service, repo } = buildService();
      vi.mocked(repo.findById).mockResolvedValue(makeRt());
      vi.mocked(repo.delete).mockResolvedValue(makeRt());
      await service.remove(ctx, 'rt-1');
      expect(repo.delete).toHaveBeenCalledWith('rt-1');
    });
  });

  describe('setActive', () => {
    it('throws NotFoundException when not found', async () => {
      const { service, repo } = buildService();
      vi.mocked(repo.findById).mockResolvedValue(null);
      await expect(service.setActive(ctx, 'rt-99', false)).rejects.toThrow(NotFoundException);
    });

    it('calls repo.setActive with correct args', async () => {
      const { service, repo } = buildService();
      vi.mocked(repo.findById).mockResolvedValue(makeRt());
      vi.mocked(repo.setActive).mockResolvedValue(makeRt({ isActive: false }));
      await service.setActive(ctx, 'rt-1', false);
      expect(repo.setActive).toHaveBeenCalledWith('rt-1', false);
    });
  });

  describe('toResponse', () => {
    it('serializes startDate to YYYY-MM-DD', () => {
      const { service } = buildService();
      const result = service.toResponse(makeRt());
      expect(result.startDate).toBe('2026-01-01');
    });

    it('returns null for null endDate', () => {
      const { service } = buildService();
      const result = service.toResponse(makeRt({ endDate: null }));
      expect(result.endDate).toBeNull();
    });
  });
});
