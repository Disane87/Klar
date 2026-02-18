import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { IncomeService } from './income.service';
import { environment } from '@env/environment';

describe('IncomeService', () => {
  let service: IncomeService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });
    service = TestBed.inject(IncomeService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should fetch all incomes', () => {
    const mockIncomes = [{ id: '1', name: 'Salary', amount: 3500 }];
    service.getAll(1, 2026).subscribe((incomes) => {
      expect(incomes.length).toBe(1);
    });

    const req = httpMock.expectOne(
      `${environment.apiUrl}/incomes?month=1&year=2026`,
    );
    expect(req.request.method).toBe('GET');
    req.flush(mockIncomes);
  });

  it('should create an income', () => {
    const dto = { name: 'Salary', amount: 3500, month: 1, year: 2026 };
    service.create(dto).subscribe((income) => {
      expect(income.name).toBe('Salary');
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/incomes`);
    expect(req.request.method).toBe('POST');
    req.flush({ id: '1', ...dto });
  });

  it('should delete an income', () => {
    service.delete('income-1').subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/incomes/income-1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});
