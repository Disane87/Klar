import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { BudgetService } from './budget.service';
import { environment } from '@env/environment';

describe('BudgetService', () => {
  let service: BudgetService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });
    service = TestBed.inject(BudgetService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should fetch all budget entries', () => {
    const mockEntries = [{ id: '1', name: 'Netflix', amount: 15.99 }];
    service.getAll(1, 2026).subscribe((entries) => {
      expect(entries).toEqual(mockEntries as any);
    });

    const req = httpMock.expectOne(
      `${environment.apiUrl}/budgets?month=1&year=2026`,
    );
    expect(req.request.method).toBe('GET');
    req.flush(mockEntries);
  });

  it('should fetch budget summary', () => {
    const mockSummary = { totalIncome: 3500, totalExpenses: 500, remaining: 3000 };
    service.getSummary(1, 2026).subscribe((summary) => {
      expect(summary.remaining).toBe(3000);
    });

    const req = httpMock.expectOne(
      `${environment.apiUrl}/budgets/summary?month=1&year=2026`,
    );
    expect(req.request.method).toBe('GET');
    req.flush(mockSummary);
  });

  it('should create a budget entry', () => {
    const dto = { name: 'Netflix', amount: 15.99, categoryId: 'cat-1', month: 1, year: 2026 };
    service.create(dto).subscribe((entry) => {
      expect(entry.name).toBe('Netflix');
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/budgets`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(dto);
    req.flush({ id: '1', ...dto });
  });

  it('should delete a budget entry', () => {
    service.delete('entry-1').subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/budgets/entry-1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});
