import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ImportPipelineService } from './import-pipeline.service';
import type { ImportPipelineRepository } from './import-pipeline.repository';
import type { RawBooking } from './types';

const ctxFinTS = {
  householdId: 'hh1',
  accountId: 'acc-fints',
  triggeredByUserId: null,
  source: 'fints' as const,
  fintsSyncRunId: 'run-1',
};

const makeBooking = (overrides: Partial<RawBooking> = {}): RawBooking => ({
  iban: 'DE39370501980000000001',
  bookingDate: '2026-04-15',
  amountCents: -2995,
  currency: 'EUR',
  purposeRaw: 'Spotify Premium',
  counterpartyName: 'Spotify AB',
  counterpartyIban: 'DE00500700100123456789',
  bankTxId: 'EREF-001',
  source: 'fints',
  sourceRunId: 'run-1',
  ...overrides,
});

function buildService() {
  const repo = {
    findExistingRefs: vi.fn().mockResolvedValue([]),
    findExistingHashes: vi.fn().mockResolvedValue([]),
    createTransaction: vi.fn().mockResolvedValue({}),
    findFallbackCategory: vi.fn().mockImplementation(async (_h, type) =>
      type === 'income' ? 'cat-income' : 'cat-expense',
    ),
  } as unknown as ImportPipelineRepository;
  const service = new ImportPipelineService(repo);
  return { service, repo };
}

describe('ImportPipelineService.ingest', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns zero counts for an empty batch', async () => {
    const { service, repo } = buildService();
    const result = await service.ingest([], ctxFinTS);
    expect(result).toEqual({ imported: 0, skipped: 0, skippedExternalRef: 0, skippedExternalHash: 0 });
    expect(repo.createTransaction).not.toHaveBeenCalled();
  });

  it('inserts a fresh booking with bankFieldsLockedAt for FinTS source', async () => {
    const { service, repo } = buildService();
    const result = await service.ingest([makeBooking()], ctxFinTS);
    expect(result.imported).toBe(1);
    expect(repo.createTransaction).toHaveBeenCalledOnce();
    const call = vi.mocked(repo.createTransaction).mock.calls[0][0];
    expect(call.source).toBe('fints');
    expect(call.fintsSyncRunId).toBe('run-1');
    expect(call.bankFieldsLockedAt).toBeInstanceOf(Date);
    expect(call.externalRef).toBe('EREF-001');
    expect(call.amountCents).toBe(-2995);
    expect(call.categoryId).toBe('cat-expense');
  });

  it('does not lock bank fields for csv source', async () => {
    const { service, repo } = buildService();
    await service.ingest([makeBooking({ source: 'csv' })], {
      ...ctxFinTS,
      source: 'csv',
      sourceImportId: 'imp-1',
      fintsSyncRunId: undefined,
    });
    const call = vi.mocked(repo.createTransaction).mock.calls[0][0];
    expect(call.bankFieldsLockedAt).toBeNull();
    expect(call.source).toBe('csv');
    expect(call.sourceImportId).toBe('imp-1');
  });

  it('skips bookings whose externalRef is already known', async () => {
    const { service, repo } = buildService();
    vi.mocked(repo.findExistingRefs).mockResolvedValue(['EREF-001']);
    const result = await service.ingest([makeBooking()], ctxFinTS);
    expect(result.imported).toBe(0);
    expect(result.skippedExternalRef).toBe(1);
    expect(repo.createTransaction).not.toHaveBeenCalled();
  });

  it('skips bookings whose externalHash is already known', async () => {
    const { service, repo } = buildService();
    const booking = makeBooking({ bankTxId: undefined });
    // Compute the hash the service will produce so the mock returns a hit.
    const result = await service.ingest([booking, booking], ctxFinTS);
    // First insert succeeds, second is detected as in-batch duplicate.
    expect(result.imported).toBe(1);
    expect(result.skippedExternalHash).toBe(1);
  });

  it('uses the income fallback category for positive amounts', async () => {
    const { service, repo } = buildService();
    await service.ingest([makeBooking({ amountCents: 50000, bankTxId: 'CRED-1' })], ctxFinTS);
    const call = vi.mocked(repo.createTransaction).mock.calls[0][0];
    expect(call.categoryId).toBe('cat-income');
  });

  it('throws when household has no usable category', async () => {
    const { service, repo } = buildService();
    vi.mocked(repo.findFallbackCategory).mockResolvedValue(null);
    await expect(service.ingest([makeBooking()], ctxFinTS)).rejects.toThrow(
      /no usable income\/expense category/,
    );
  });

  it('handles a mix of new + duplicate-by-ref + in-batch hash dup in one batch', async () => {
    const { service, repo } = buildService();
    vi.mocked(repo.findExistingRefs).mockResolvedValue(['EREF-OLD']);
    // Each booking is distinct so default hashes don't collide.
    const fresh = makeBooking({
      bankTxId: 'EREF-NEW',
      bookingDate: '2026-04-01',
      amountCents: -1000,
    });
    const dupRef = makeBooking({
      bankTxId: 'EREF-OLD',
      bookingDate: '2026-04-02',
      amountCents: -2000,
    });
    const cashOnce = makeBooking({
      bankTxId: undefined,
      bookingDate: '2026-04-03',
      amountCents: -300,
      counterpartyName: 'Bargeld',
      purposeRaw: 'Geldautomat',
    });
    const cashAgain = makeBooking({
      bankTxId: undefined,
      bookingDate: '2026-04-03',
      amountCents: -300,
      counterpartyName: 'Bargeld',
      purposeRaw: 'Geldautomat',
    });

    const result = await service.ingest(
      [fresh, dupRef, cashOnce, cashAgain],
      ctxFinTS,
    );
    expect(result.imported).toBe(2); // fresh + cashOnce
    expect(result.skippedExternalRef).toBe(1); // dupRef
    expect(result.skippedExternalHash).toBe(1); // cashAgain
  });
});
