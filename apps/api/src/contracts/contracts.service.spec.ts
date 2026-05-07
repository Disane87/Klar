import { describe, it, expect, vi } from 'vitest';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ContractsService } from './contracts.service';
import { ContractCycle, ContractStatus } from '@prisma/client';
import type { ContractsRepository } from './contracts.repository';
import type { Contract } from '@prisma/client';
import type { RequestContext } from '../common/types/request-context.type';

const ctx: RequestContext = { userId: 'u1', householdId: 'hh1', source: 'web' };

const makeContract = (overrides: Partial<Contract> = {}): Contract => ({
  id: 'c-1',
  householdId: 'hh1',
  name: 'Spotify',
  merchant: 'spotify',
  categoryId: null,
  amountCents: -999,
  cycle: ContractCycle.MONTHLY,
  nextRenewalAt: new Date('2026-06-01'),
  cancelByAt: null,
  confidence: 1,
  status: ContractStatus.CONFIRMED,
  detectedFromTransactionIds: [],
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  ...overrides,
});

function build() {
  const repo = {
    findAll: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    loadDetectionInput: vi.fn(),
    replaceCandidates: vi.fn(),
  } as unknown as ContractsRepository;
  const service = new ContractsService(repo);
  return { service, repo };
}

describe('ContractsService', () => {
  describe('list', () => {
    it('passes status filter to repo', async () => {
      const { service, repo } = build();
      vi.mocked(repo.findAll).mockResolvedValue([]);
      await service.list(ctx, { status: ContractStatus.CANDIDATE });
      expect(repo.findAll).toHaveBeenCalledWith('hh1', { status: ContractStatus.CANDIDATE });
    });
  });

  describe('create', () => {
    it('rejects empty name', async () => {
      const { service } = build();
      await expect(
        service.create(ctx, {
          name: '   ',
          amountCents: -1000,
          cycle: ContractCycle.MONTHLY,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects non-integer amountCents', async () => {
      const { service } = build();
      await expect(
        service.create(ctx, {
          name: 'Spotify',
          amountCents: 9.99,
          cycle: ContractCycle.MONTHLY,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates with confidence=1 + status=CONFIRMED by default', async () => {
      const { service, repo } = build();
      vi.mocked(repo.create).mockResolvedValue(makeContract());
      await service.create(ctx, {
        name: 'Spotify',
        amountCents: -999,
        cycle: ContractCycle.MONTHLY,
      });
      expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({
        householdId: 'hh1',
        name: 'Spotify',
        confidence: 1,
        status: ContractStatus.CONFIRMED,
      }));
    });
  });

  describe('update', () => {
    it('throws NotFound when missing', async () => {
      const { service, repo } = build();
      vi.mocked(repo.findById).mockResolvedValue(null);
      await expect(service.update(ctx, 'c-x', { name: 'x' })).rejects.toThrow(NotFoundException);
    });

    it('rejects float amountCents', async () => {
      const { service, repo } = build();
      vi.mocked(repo.findById).mockResolvedValue(makeContract());
      await expect(service.update(ctx, 'c-1', { amountCents: 1.5 })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('updates the contract', async () => {
      const { service, repo } = build();
      vi.mocked(repo.findById).mockResolvedValue(makeContract());
      vi.mocked(repo.update).mockResolvedValue(makeContract({ name: 'New name' }));
      const result = await service.update(ctx, 'c-1', { name: 'New name' });
      expect(result.name).toBe('New name');
    });
  });

  describe('remove', () => {
    it('throws NotFound when missing', async () => {
      const { service, repo } = build();
      vi.mocked(repo.findById).mockResolvedValue(null);
      await expect(service.remove(ctx, 'c-x')).rejects.toThrow(NotFoundException);
    });

    it('deletes when found', async () => {
      const { service, repo } = build();
      vi.mocked(repo.findById).mockResolvedValue(makeContract());
      vi.mocked(repo.delete).mockResolvedValue(undefined);
      await service.remove(ctx, 'c-1');
      expect(repo.delete).toHaveBeenCalledWith('c-1', 'hh1');
    });
  });

  describe('recompute', () => {
    it('runs detection over loaded transactions and replaces candidates', async () => {
      const { service, repo } = build();
      vi.mocked(repo.loadDetectionInput).mockResolvedValue([
        { id: 't1', date: new Date('2026-01-01'), amountCents: -999, counterparty: 'Spotify AB' },
        { id: 't2', date: new Date('2026-02-01'), amountCents: -999, counterparty: 'Spotify AB' },
        { id: 't3', date: new Date('2026-03-01'), amountCents: -999, counterparty: 'Spotify AB' },
        { id: 't4', date: new Date('2026-04-01'), amountCents: -999, counterparty: 'Spotify AB' },
      ]);
      vi.mocked(repo.replaceCandidates).mockResolvedValue({ deleted: 2, created: 1 });
      const result = await service.recompute(ctx);
      expect(repo.replaceCandidates).toHaveBeenCalledTimes(1);
      const candidates = vi.mocked(repo.replaceCandidates).mock.calls[0][1];
      expect(candidates).toHaveLength(1);
      expect(candidates[0].cycle).toBe(ContractCycle.MONTHLY);
      expect(candidates[0].status).toBe(ContractStatus.CANDIDATE);
      expect(result).toEqual({ created: 1, replaced: 2 });
    });

    it('skips transactions with no counterparty', async () => {
      const { service, repo } = build();
      vi.mocked(repo.loadDetectionInput).mockResolvedValue([
        { id: 't1', date: new Date('2026-01-01'), amountCents: -100, counterparty: null },
        { id: 't2', date: new Date('2026-02-01'), amountCents: -100, counterparty: null },
        { id: 't3', date: new Date('2026-03-01'), amountCents: -100, counterparty: null },
      ]);
      vi.mocked(repo.replaceCandidates).mockResolvedValue({ deleted: 0, created: 0 });
      await service.recompute(ctx);
      const candidates = vi.mocked(repo.replaceCandidates).mock.calls[0][1];
      expect(candidates).toEqual([]);
    });
  });

  describe('toResponse', () => {
    it('serializes dates to YYYY-MM-DD strings', () => {
      const { service } = build();
      const r = service.toResponse(makeContract());
      expect(r.nextRenewalAt).toBe('2026-06-01');
      expect(r.cancelByAt).toBeNull();
      expect(r.createdAt).toBe(new Date('2026-01-01').toISOString());
    });
  });
});
