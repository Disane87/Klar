import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { FixedCostsService } from './fixed-costs.service';

describe('FixedCostsService', () => {
  let service: FixedCostsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), FixedCostsService],
    });
    service = TestBed.inject(FixedCostsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('list() forwards status / source / contractsOnly as query params', () => {
    service.list('h1', { status: 'CANDIDATE', source: 'AUTO_DETECTED', contractsOnly: true }).subscribe();
    const req = httpMock.expectOne(r =>
      r.url === '/api/v1/households/h1/fixed-costs' &&
      r.params.get('status') === 'CANDIDATE' &&
      r.params.get('source') === 'AUTO_DETECTED' &&
      r.params.get('contractsOnly') === 'true',
    );
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('create / update / remove / recompute hit the right routes', () => {
    service.create('h1', { name: 'X', amountCents: -100, cycle: 'MONTHLY' }).subscribe();
    httpMock.expectOne({ url: '/api/v1/households/h1/fixed-costs', method: 'POST' }).flush({});

    service.update('h1', 'fc1', { name: 'Y' }).subscribe();
    httpMock.expectOne({ url: '/api/v1/households/h1/fixed-costs/fc1', method: 'PATCH' }).flush({});

    service.remove('h1', 'fc1').subscribe();
    httpMock.expectOne({ url: '/api/v1/households/h1/fixed-costs/fc1', method: 'DELETE' }).flush(null);

    service.recompute('h1').subscribe();
    httpMock.expectOne({ url: '/api/v1/households/h1/fixed-costs/recompute', method: 'POST' })
      .flush({ created: 0, replaced: 0 });
  });

  it('bulkStatus posts ids + status', () => {
    service.bulkStatus('h1', { ids: ['a', 'b'], status: 'CONFIRMED' }).subscribe();
    const req = httpMock.expectOne({
      url: '/api/v1/households/h1/fixed-costs/bulk-status',
      method: 'POST',
    });
    expect(req.request.body).toEqual({ ids: ['a', 'b'], status: 'CONFIRMED' });
    req.flush({ updated: 2 });
  });

  it('promoteToContract / updateContract / demoteContract hit the right routes', () => {
    service.promoteToContract('h1', 'fc1', { contractHolder: 'Marco' }).subscribe();
    httpMock.expectOne({ url: '/api/v1/households/h1/fixed-costs/fc1/contract', method: 'POST' }).flush({});

    service.updateContract('h1', 'fc1', { cancelByAt: '2026-12-31' }).subscribe();
    httpMock.expectOne({ url: '/api/v1/households/h1/fixed-costs/fc1/contract', method: 'PATCH' }).flush({});

    service.demoteContract('h1', 'fc1').subscribe();
    httpMock.expectOne({ url: '/api/v1/households/h1/fixed-costs/fc1/contract', method: 'DELETE' }).flush(null);
  });
});
