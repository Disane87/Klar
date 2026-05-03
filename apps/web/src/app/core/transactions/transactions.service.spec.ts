import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { provideHttpClient } from '@angular/common/http';
import { TransactionsService } from './transactions.service';
import { vi } from 'vitest';
import { of } from 'rxjs';

const mockTransaction = {
  id: 't-1',
  householdId: 'hh-1',
  projectId: null,
  categoryId: 'cat-1',
  amountCents: -5000,
  date: '2026-05-01',
  note: null,
  visibility: 'INTERNAL',
  createdAt: '2026-05-01',
  updatedAt: '2026-05-01',
};

describe('TransactionsService', () => {
  let service: TransactionsService;
  let httpClient: { post: ReturnType<typeof vi.fn>; patch: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    httpClient = {
      post: vi.fn().mockReturnValue(of(mockTransaction)),
      patch: vi.fn().mockReturnValue(of(mockTransaction)),
      delete: vi.fn().mockReturnValue(of(undefined)),
    };

    TestBed.configureTestingModule({
      providers: [
        TransactionsService,
        { provide: HttpClient, useValue: httpClient },
      ],
    });
    service = TestBed.inject(TransactionsService);
  });

  describe('create()', () => {
    it('should POST to correct endpoint', async () => {
      const body = {
        amountCents: -5000,
        categoryId: 'cat-1',
        date: '2026-05-01',
      };

      await service.create('hh-1', body);

      expect(httpClient.post).toHaveBeenCalledWith(
        '/api/v1/households/hh-1/transactions',
        body,
      );
    });
  });

  describe('patch()', () => {
    it('should PATCH to correct endpoint', async () => {
      const body = { note: 'Test note' };

      await service.patch('hh-1', 't-1', body);

      expect(httpClient.patch).toHaveBeenCalledWith(
        '/api/v1/households/hh-1/transactions/t-1',
        body,
      );
    });
  });

  describe('delete()', () => {
    it('should DELETE from correct endpoint', async () => {
      await service.delete('hh-1', 't-1');

      expect(httpClient.delete).toHaveBeenCalledWith(
        '/api/v1/households/hh-1/transactions/t-1',
      );
    });
  });
});