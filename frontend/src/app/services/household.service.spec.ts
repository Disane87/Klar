import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { HouseholdService } from './household.service';
import { environment } from '@env/environment';

describe('HouseholdService', () => {
  let service: HouseholdService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });
    service = TestBed.inject(HouseholdService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should fetch all households', () => {
    const mockData = [{ id: '1', name: 'Family' }];
    service.getAll().subscribe((data) => {
      expect(data.length).toBe(1);
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/households`);
    expect(req.request.method).toBe('GET');
    req.flush(mockData);
  });

  it('should create a household', () => {
    service.create('Test Family').subscribe((h) => {
      expect(h.name).toBe('Test Family');
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/households`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ name: 'Test Family' });
    req.flush({ id: '1', name: 'Test Family', inviteCode: 'abc' });
  });

  it('should join a household', () => {
    service.join('abc123').subscribe((h) => {
      expect(h.name).toBe('Family');
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/households/join`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ inviteCode: 'abc123' });
    req.flush({ id: '1', name: 'Family', inviteCode: 'abc123' });
  });

  it('should get household summary', () => {
    service.getSummary('h-1', 1, 2026).subscribe((summary) => {
      expect(summary.remaining).toBe(3000);
    });

    const req = httpMock.expectOne(
      `${environment.apiUrl}/households/h-1/summary?month=1&year=2026`,
    );
    expect(req.request.method).toBe('GET');
    req.flush({ totalIncome: 5000, totalExpenses: 2000, remaining: 3000, members: [] });
  });
});
