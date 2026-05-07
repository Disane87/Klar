import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ContractsService } from './contracts.service';

describe('ContractsService', () => {
  let service: ContractsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), ContractsService],
    });
    service = TestBed.inject(ContractsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('list() filters by status', () => {
    service.list('h1', 'CANDIDATE').subscribe();
    const req = httpMock.expectOne(r =>
      r.url === '/api/v1/households/h1/contracts' && r.params.get('status') === 'CANDIDATE',
    );
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('create / update / remove / recompute hit the right verbs', () => {
    service.create('h1', { name: 'X', amountCents: -100, cycle: 'MONTHLY' }).subscribe();
    httpMock.expectOne({ url: '/api/v1/households/h1/contracts', method: 'POST' }).flush({});

    service.update('h1', 'c1', { name: 'Y' }).subscribe();
    httpMock.expectOne({ url: '/api/v1/households/h1/contracts/c1', method: 'PATCH' }).flush({});

    service.remove('h1', 'c1').subscribe();
    httpMock.expectOne({ url: '/api/v1/households/h1/contracts/c1', method: 'DELETE' }).flush(null);

    service.recompute('h1').subscribe();
    httpMock.expectOne({ url: '/api/v1/households/h1/contracts/recompute', method: 'POST' })
      .flush({ count: 0 });
  });
});
