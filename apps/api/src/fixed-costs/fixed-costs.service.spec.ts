import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FixedCostsService } from './fixed-costs.service';
import {
  type FixedCostsRepository,
  type FixedCostWithContract,
} from './fixed-costs.repository';
import type { RequestContext } from '../common/types/request-context.type';

const ctx: RequestContext = { userId: 'u1', householdId: 'hh1', source: 'web' };

function makeRow(
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
    status: 'CANDIDATE',
    source: 'AUTO_DETECTED',
    detectedFromTransactionIds: ['tx1', 'tx2', 'tx3'],
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    contract: null,
    ...overrides,
  };
}

function makeRepo(): FixedCostsRepository {
  return {
    findAll: vi.fn().mockResolvedValue([]),
    findById: vi.fn().mockResolvedValue(makeRow()),
    create: vi.fn().mockImplementation(async (data: unknown) =>
      makeRow({ ...(data as Partial<FixedCostWithContract>) }),
    ),
    update: vi
      .fn()
      .mockImplementation(async (id: string, _hh: string, data: unknown) =>
        makeRow({ id, ...(data as Partial<FixedCostWithContract>) }),
      ),
    delete: vi.fn().mockResolvedValue(undefined),
    bulkUpdateStatus: vi.fn().mockResolvedValue(2),
    loadDetectionInput: vi.fn().mockResolvedValue([]),
    replaceAutoCandidates: vi.fn().mockResolvedValue({ deleted: 0, created: 0 }),
  } as unknown as FixedCostsRepository;
}

describe('FixedCostsService', () => {
  let repo: FixedCostsRepository;
  let svc: FixedCostsService;

  beforeEach(() => {
    repo = makeRepo();
    svc = new FixedCostsService(repo);
  });

  describe('list', () => {
    it('forwards filter opts to the repository', async () => {
      await svc.list(ctx, { status: 'CANDIDATE', source: 'AUTO_DETECTED' });
      expect(repo.findAll).toHaveBeenCalledWith('hh1', {
        status: 'CANDIDATE',
        source: 'AUTO_DETECTED',
      });
    });
  });

  describe('create', () => {
    it('rejects empty name', async () => {
      await expect(
        svc.create(ctx, {
          name: '   ',
          amountCents: -100,
          cycle: 'MONTHLY',
        }),
      ).rejects.toThrow(/Name/);
    });

    it('rejects non-integer amountCents', async () => {
      await expect(
        svc.create(ctx, {
          name: 'X',
          amountCents: -1.5,
          cycle: 'MONTHLY',
        }),
      ).rejects.toThrow(/Ganzzahl/);
    });

    it('defaults to status=CONFIRMED, source=USER_DEFINED, confidence=1', async () => {
      await svc.create(ctx, { name: 'X', amountCents: -1500, cycle: 'MONTHLY' });
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'CONFIRMED',
          source: 'USER_DEFINED',
          confidence: 1,
        }),
      );
    });
  });

  describe('update', () => {
    it('throws NotFoundException when the row is missing', async () => {
      (repo.findById as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
      await expect(svc.update(ctx, 'missing', { name: 'X' })).rejects.toThrow(
        /nicht gefunden/,
      );
    });

    it('rejects float amountCents', async () => {
      await expect(svc.update(ctx, 'fc1', { amountCents: 1.2 })).rejects.toThrow(
        /Ganzzahl/,
      );
    });
  });

  describe('remove', () => {
    it('throws NotFoundException when the row is missing', async () => {
      (repo.findById as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
      await expect(svc.remove(ctx, 'missing')).rejects.toThrow(/nicht gefunden/);
    });
  });

  describe('bulkUpdateStatus', () => {
    it('passes ids and status through to the repo', async () => {
      const result = await svc.bulkUpdateStatus(ctx, ['a', 'b'], 'CONFIRMED');
      expect(repo.bulkUpdateStatus).toHaveBeenCalledWith('hh1', ['a', 'b'], 'CONFIRMED');
      expect(result.updated).toBe(2);
    });
  });

  describe('recomputeForHousehold', () => {
    it('runs the detection on returned transactions and replaces candidates', async () => {
      (repo.loadDetectionInput as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
        { id: '1', date: new Date('2025-01-15T00:00:00Z'), amountCents: -999, counterparty: 'Spotify', description: null },
        { id: '2', date: new Date('2025-02-15T00:00:00Z'), amountCents: -999, counterparty: 'Spotify', description: null },
        { id: '3', date: new Date('2025-03-15T00:00:00Z'), amountCents: -999, counterparty: 'Spotify', description: null },
      ]);
      (repo.replaceAutoCandidates as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        deleted: 0,
        created: 1,
      });
      const result = await svc.recomputeForHousehold('hh1');
      expect(result).toEqual({ created: 1, replaced: 0 });
      expect(repo.replaceAutoCandidates).toHaveBeenCalledWith(
        'hh1',
        expect.arrayContaining([
          expect.objectContaining({
            householdId: 'hh1',
            cycle: 'MONTHLY',
            status: 'CANDIDATE',
            source: 'AUTO_DETECTED',
          }),
        ]),
      );
    });

    it('skips transactions with null counterparty', async () => {
      (repo.loadDetectionInput as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
        { id: '1', date: new Date('2025-01-15T00:00:00Z'), amountCents: -999, counterparty: null, description: null },
        { id: '2', date: new Date('2025-02-15T00:00:00Z'), amountCents: -999, counterparty: null, description: null },
        { id: '3', date: new Date('2025-03-15T00:00:00Z'), amountCents: -999, counterparty: null, description: null },
      ]);
      await svc.recomputeForHousehold('hh1');
      expect(repo.replaceAutoCandidates).toHaveBeenCalledWith('hh1', []);
    });
  });

  describe('toResponse', () => {
    it('serializes dates and includes contract extension when present', () => {
      const row = makeRow({
        nextRenewalAt: new Date('2026-05-15T00:00:00Z'),
        contract: {
          id: 'c1',
          fixedCostId: 'fc1',
          cancelByAt: new Date('2026-06-15T00:00:00Z'),
          contractStartedAt: new Date('2024-01-01T00:00:00Z'),
          contractHolder: 'Marco',
          contractNumber: 'ABC-123',
          providerName: 'Spotify AB',
          documentUrl: null,
          notes: null,
          createdAt: new Date('2026-01-01T00:00:00Z'),
          updatedAt: new Date('2026-01-01T00:00:00Z'),
        },
      });
      const dto = svc.toResponse(row);
      expect(dto.nextRenewalAt).toBe('2026-05-15');
      expect(dto.contract).not.toBeNull();
      expect(dto.contract!.cancelByAt).toBe('2026-06-15');
      expect(dto.contract!.providerName).toBe('Spotify AB');
    });

    it('returns contract=null when no extension exists', () => {
      const dto = svc.toResponse(makeRow());
      expect(dto.contract).toBeNull();
    });
  });
});
