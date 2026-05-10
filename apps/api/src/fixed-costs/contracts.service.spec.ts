import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ContractsService } from './contracts.service';
import { type ContractsRepository } from './contracts.repository';
import {
  type FixedCostsRepository,
  type FixedCostWithContract,
} from './fixed-costs.repository';
import type { RequestContext } from '../common/types/request-context.type';

const ctx: RequestContext = { userId: 'u1', householdId: 'hh1', source: 'web' };

function makeFc(
  overrides: Partial<FixedCostWithContract> = {},
): FixedCostWithContract {
  return {
    id: 'fc1',
    householdId: 'hh1',
    name: 'Spotify',
    merchant: 'spotify',
    categoryId: null,
    amountCents: -999,
    cycle: 'MONTHLY',
    nextRenewalAt: null,
    confidence: 0.8,
    status: 'CONFIRMED',
    source: 'AUTO_DETECTED',
    detectedFromTransactionIds: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    contract: null,
    ...overrides,
  };
}

function makeContractRow() {
  return {
    id: 'c1',
    fixedCostId: 'fc1',
    cancelByAt: null,
    contractStartedAt: null,
    contractHolder: null,
    contractNumber: null,
    providerName: null,
    documentUrl: null,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function makeRepos() {
  const fixedCosts = {
    findById: vi.fn().mockResolvedValue(makeFc()),
  } as unknown as FixedCostsRepository;
  const contracts = {
    create: vi.fn().mockResolvedValue(makeContractRow()),
    update: vi.fn().mockResolvedValue(makeContractRow()),
    delete: vi.fn().mockResolvedValue(undefined),
  } as unknown as ContractsRepository;
  return { fixedCosts, contracts };
}

describe('ContractsService', () => {
  let svc: ContractsService;
  let repos: ReturnType<typeof makeRepos>;

  beforeEach(() => {
    repos = makeRepos();
    svc = new ContractsService(repos.contracts, repos.fixedCosts);
  });

  describe('promote', () => {
    it('throws NotFoundException when the FixedCost does not exist', async () => {
      (repos.fixedCosts.findById as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
      await expect(svc.promote(ctx, 'missing', {})).rejects.toThrow(/nicht gefunden/);
    });

    it('throws ConflictException when already promoted', async () => {
      (repos.fixedCosts.findById as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        makeFc({ contract: makeContractRow() }),
      );
      await expect(svc.promote(ctx, 'fc1', {})).rejects.toThrow(/bereits ein Vertrag/);
    });

    it('creates the extension row with parsed dates', async () => {
      await svc.promote(ctx, 'fc1', {
        cancelByAt: '2026-12-31',
        contractStartedAt: '2024-01-01',
        contractHolder: 'Marco',
        contractNumber: 'X-1',
      });
      expect(repos.contracts.create).toHaveBeenCalledWith(
        'fc1',
        expect.objectContaining({
          contractHolder: 'Marco',
          contractNumber: 'X-1',
        }),
      );
      const arg = (repos.contracts.create as ReturnType<typeof vi.fn>).mock.calls[0][1];
      expect(arg.cancelByAt).toBeInstanceOf(Date);
      expect(arg.contractStartedAt).toBeInstanceOf(Date);
    });

    it('rejects when cancelByAt is before contractStartedAt', async () => {
      await expect(
        svc.promote(ctx, 'fc1', {
          cancelByAt: '2024-01-01',
          contractStartedAt: '2025-01-01',
        }),
      ).rejects.toThrow(/cancelByAt/);
    });
  });

  describe('update', () => {
    it('throws NotFoundException when the FixedCost is missing', async () => {
      (repos.fixedCosts.findById as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
      await expect(svc.update(ctx, 'missing', {})).rejects.toThrow(/nicht gefunden/);
    });

    it('throws NotFoundException when no Contract extension exists', async () => {
      (repos.fixedCosts.findById as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        makeFc({ contract: null }),
      );
      await expect(svc.update(ctx, 'fc1', {})).rejects.toThrow(
        /Vertrag-Erweiterung/,
      );
    });

    it('updates the existing extension', async () => {
      (repos.fixedCosts.findById as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        makeFc({ contract: makeContractRow() }),
      );
      await svc.update(ctx, 'fc1', { contractHolder: 'Anna' });
      expect(repos.contracts.update).toHaveBeenCalledWith(
        'c1',
        expect.objectContaining({ contractHolder: 'Anna' }),
      );
    });
  });

  describe('demote', () => {
    it('is idempotent when no extension exists', async () => {
      await svc.demote(ctx, 'fc1');
      expect(repos.contracts.delete).not.toHaveBeenCalled();
    });

    it('deletes the extension when present', async () => {
      (repos.fixedCosts.findById as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        makeFc({ contract: makeContractRow() }),
      );
      await svc.demote(ctx, 'fc1');
      expect(repos.contracts.delete).toHaveBeenCalledWith('c1');
    });

    it('throws NotFoundException when the FixedCost is missing', async () => {
      (repos.fixedCosts.findById as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
      await expect(svc.demote(ctx, 'missing')).rejects.toThrow(/nicht gefunden/);
    });
  });
});
