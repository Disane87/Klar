import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { CsvImportService } from './csv-import.service';
import { HouseholdStore } from '../household/household.store';
import { CategoriesStore } from '../categories/categories.store';
import { TransactionsStore } from '../transactions/transactions.store';
import { OverviewStore } from '../overview/overview.store';

describe('CsvImportService', () => {
  let service: CsvImportService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: HouseholdStore, useValue: { activeId: signal('hh1') } },
        { provide: CategoriesStore, useValue: { reload: () => undefined } },
        { provide: TransactionsStore, useValue: { reload: () => undefined } },
        { provide: OverviewStore, useValue: { reload: () => undefined } },
      ],
    });
    service = TestBed.inject(CsvImportService);
    http = TestBed.inject(HttpTestingController);
  });

  it('posts analyze with fileBase64', async () => {
    const p = service.analyze('AAA');
    const req = http.expectOne('/api/v1/households/hh1/csv-import/analyze');
    expect(req.request.body).toEqual({ fileBase64: 'AAA' });
    req.flush({
      summary: { total: 0, new: 0, duplicates: 0, fixedCostMatches: 0, recurringSuggestions: 0 },
      rows: [],
    });
    await p;
  });

  it('posts confirm with payload and reloads stores', async () => {
    const p = service.confirm('AAA', 'a.csv', [{ rowIndex: 0, skip: true }]);
    const req = http.expectOne('/api/v1/households/hh1/csv-import/confirm');
    expect(req.request.body.filename).toBe('a.csv');
    expect(req.request.body.rows).toHaveLength(1);
    req.flush({
      imported: 0,
      skippedDuplicates: 0,
      skippedFixed: 0,
      skippedByUser: 1,
      createdRecurrings: 0,
      csvImportId: 'i1',
    });
    const result = await p;
    expect(result.skippedByUser).toBe(1);
  });
});
