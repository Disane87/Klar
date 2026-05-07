import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CsvImportService } from './csv-import.service';
import { SparkasseCamtV2Parser } from './parsers/sparkasse-camt-v2.parser';
import type { CsvImportRepository } from './csv-import.repository';
import type { AccountsService } from '../accounts/accounts.service';
import type { RequestContext } from '../common/types/request-context.type';

const ctx: RequestContext = { userId: 'user1', householdId: 'hh1', source: 'web' };

const csvWithOneRow = () => {
  const header = [
    'Auftragskonto', 'Buchungstag', 'Valutadatum', 'Buchungstext', 'Verwendungszweck',
    'Glaeubiger ID', 'Mandatsreferenz', 'Kundenreferenz (End-to-End)', 'Sammlerreferenz',
    'Lastschrift Ursprungsbetrag', 'Auslagenersatz Ruecklastschrift',
    'Beguenstigter/Zahlungspflichtiger', 'Kontonummer/IBAN', 'BIC (SWIFT-Code)',
    'Betrag', 'Waehrung', 'Info',
  ].map(h => `"${h}"`).join(';');
  const r = [
    'DE111', '15.04.26', '15.04.26', 'X', 'EREF+ref-1 Kauf', '', '', 'ref-1', '', '', '',
    'REWE', 'DE222', 'X', '-15,99', 'EUR', '',
  ].map(v => `"${v}"`).join(';');
  return Buffer.from([header, r].join('\n'), 'latin1').toString('base64');
};

function makeRepo(): CsvImportRepository {
  return {
    createCsvImport: vi.fn().mockResolvedValue({ id: 'imp1' }),
    finalizeCsvImport: vi.fn().mockResolvedValue({}),
    loadExistingRefs: vi.fn().mockResolvedValue([]),
    loadExistingHashes: vi.fn().mockResolvedValue([]),
    loadActiveRecurrings: vi.fn().mockResolvedValue([]),
    loadRecentTransactions: vi.fn().mockResolvedValue([]),
    loadLearnings: vi.fn().mockResolvedValue([]),
    upsertLearning: vi.fn().mockResolvedValue(undefined),
    createTransaction: vi.fn().mockResolvedValue({}),
    createRecurring: vi.fn().mockResolvedValue({}),
    assertCategoryInHousehold: vi.fn().mockResolvedValue({ id: 'cat1' }),
    assertProjectInHousehold: vi.fn().mockResolvedValue({ id: 'p1' }),
  } as unknown as CsvImportRepository;
}

function makeAccounts(): AccountsService {
  return {
    ensureDefaultAccountId: vi.fn().mockResolvedValue('acc-default'),
    findById: vi.fn(),
    list: vi.fn(),
    toResponse: vi.fn(),
  } as unknown as AccountsService;
}

describe('CsvImportService', () => {
  let repo: CsvImportRepository;
  let accounts: AccountsService;
  let service: CsvImportService;

  beforeEach(() => {
    repo = makeRepo();
    accounts = makeAccounts();
    service = new CsvImportService(new SparkasseCamtV2Parser(), repo, accounts);
  });

  it('analyze returns NEW status for unseen row', async () => {
    const result = await service.analyze(ctx, csvWithOneRow());
    expect(result.summary.total).toBe(1);
    expect(result.rows[0].status).toBe('NEW');
  });

  it('analyze marks duplicate when externalRef known', async () => {
    (repo.loadExistingRefs as ReturnType<typeof vi.fn>).mockResolvedValue(['ref-1']);
    const result = await service.analyze(ctx, csvWithOneRow());
    expect(result.rows[0].status).toBe('DUPLICATE');
  });

  it('confirm imports row and upserts learning', async () => {
    const result = await service.confirm(ctx, csvWithOneRow(), {
      filename: 'a.csv',
      rows: [
        {
          rowIndex: 0,
          skip: false,
          categoryId: 'cat1',
          projectId: null,
          visibility: 'SHARED',
          createNewRecurring: false,
        },
      ],
    });
    expect(result.imported).toBe(1);
    expect(repo.createTransaction).toHaveBeenCalledTimes(1);
    expect(repo.upsertLearning).toHaveBeenCalledWith('hh1', 'rewe', 'cat1');
  });

  it('confirm with skip increments correct counter', async () => {
    const result = await service.confirm(ctx, csvWithOneRow(), {
      filename: 'a.csv',
      rows: [{ rowIndex: 0, skip: true, skipReason: 'fixed' }],
    });
    expect(result.skippedFixed).toBe(1);
    expect(result.imported).toBe(0);
  });

  it('confirm rejects categoryId not in household', async () => {
    (repo.assertCategoryInHousehold as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    await expect(
      service.confirm(ctx, csvWithOneRow(), {
        filename: 'a.csv',
        rows: [
          {
            rowIndex: 0,
            skip: false,
            categoryId: 'evil-cat',
            projectId: null,
            visibility: 'SHARED',
            createNewRecurring: false,
          },
        ],
      }),
    ).rejects.toThrow();
  });

  it('confirm with createNewRecurring creates recurring + transaction', async () => {
    const result = await service.confirm(ctx, csvWithOneRow(), {
      filename: 'a.csv',
      rows: [
        {
          rowIndex: 0,
          skip: false,
          categoryId: 'cat1',
          projectId: null,
          visibility: 'SHARED',
          createNewRecurring: true,
        },
      ],
    });
    expect(result.createdRecurrings).toBe(1);
    expect(repo.createRecurring).toHaveBeenCalledOnce();
    expect(repo.createTransaction).toHaveBeenCalledOnce();
  });
});
