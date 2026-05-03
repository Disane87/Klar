import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { provideHttpClient } from '@angular/common/http';
import { RecurringTransactionsService, type RecurringTransactionResponse } from './recurring-transactions.service';
import { vi } from 'vitest';
import { firstValueFrom, of } from 'rxjs';

vi.mock('rxjs', () => ({
  firstValueFrom: vi.fn((obs) => Promise.resolve(obs)),
  of: vi.fn(),
}));

const mockResponse: RecurringTransactionResponse = {
  id: 'rt-1',
  householdId: 'hh-1',
  createdByUserId: 'u-1',
  name: 'Netflix',
  amountCents: 1599,
  categoryId: 'cat-1',
  projectId: null,
  frequency: 'MONTHLY',
  customDays: null,
  dayOfMonth: 1,
  startDate: '2026-01-01',
  endDate: null,
  visibility: 'INTERNAL',
  isVariable: false,
  note: null,
  isActive: true,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
};

describe('RecurringTransactionsService', () => {
  let service: RecurringTransactionsService;
  let httpClient: { post: ReturnType<typeof vi.fn>; patch: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    httpClient = {
      post: vi.fn().mockReturnValue(of(mockResponse)),
      patch: vi.fn().mockReturnValue(of(undefined)),
      delete: vi.fn().mockReturnValue(of(undefined)),
    };

    vi.mocked(firstValueFrom).mockImplementation((obs: any) => {
      return Promise.resolve(obs?.source?._value ?? obs?.value ?? mockResponse);
    });

    TestBed.configureTestingModule({
      providers: [
        RecurringTransactionsService,
        { provide: HttpClient, useValue: httpClient },
      ],
    });
    service = TestBed.inject(RecurringTransactionsService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('create()', () => {
    it('should POST to correct endpoint', async () => {
      const body = {
        name: 'Netflix',
        amountCents: 1599,
        categoryId: 'cat-1',
        frequency: 'MONTHLY',
        startDate: '2026-01-01',
      };

      const result = await service.create('hh-1', body);

      expect(httpClient.post).toHaveBeenCalledWith(
        '/api/v1/households/hh-1/recurring-transactions',
        body,
      );
      expect(result).toBeDefined();
    });

    it('should include all body fields', async () => {
      const body = {
        name: 'Spotify',
        amountCents: 999,
        categoryId: 'cat-2',
        frequency: 'YEARLY',
        dayOfMonth: 15,
        startDate: '2026-01-01',
        projectId: 'proj-1',
        note: 'Premium Family',
        isActive: true,
      };

      await service.create('hh-1', body);

      expect(httpClient.post).toHaveBeenCalledWith(
        '/api/v1/households/hh-1/recurring-transactions',
        body,
      );
    });
  });

  describe('patch()', () => {
    it('should PATCH to correct endpoint', async () => {
      const body = { name: 'Updated Name', amountCents: 2000 };

      await service.patch('hh-1', 'rt-1', body);

      expect(httpClient.patch).toHaveBeenCalledWith(
        '/api/v1/households/hh-1/recurring-transactions/rt-1',
        body,
      );
    });

    it('should handle partial updates', async () => {
      const body = { dayOfMonth: 20 };

      await service.patch('hh-1', 'rt-1', body);

      expect(httpClient.patch).toHaveBeenCalledWith(
        '/api/v1/households/hh-1/recurring-transactions/rt-1',
        body,
      );
    });
  });

  describe('delete()', () => {
    it('should DELETE from correct endpoint', async () => {
      await service.delete('hh-1', 'rt-1');

      expect(httpClient.delete).toHaveBeenCalledWith(
        '/api/v1/households/hh-1/recurring-transactions/rt-1',
      );
    });
  });
});