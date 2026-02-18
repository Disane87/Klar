import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { BudgetEntry, CreateBudgetEntryRequest, BudgetSummary } from '../models/budget.model';

/** Service for budget entry CRUD and summary operations. */
@Injectable({ providedIn: 'root' })
export class BudgetService {
  private readonly baseUrl = `${environment.apiUrl}/budgets`;

  constructor(private http: HttpClient) {}

  getAll(month?: number, year?: number): Observable<BudgetEntry[]> {
    let params = new HttpParams();
    if (month) params = params.set('month', month);
    if (year) params = params.set('year', year);
    return this.http.get<BudgetEntry[]>(this.baseUrl, { params });
  }

  getSummary(month: number, year: number): Observable<BudgetSummary> {
    const params = new HttpParams().set('month', month).set('year', year);
    return this.http.get<BudgetSummary>(`${this.baseUrl}/summary`, { params });
  }

  create(entry: CreateBudgetEntryRequest): Observable<BudgetEntry> {
    return this.http.post<BudgetEntry>(this.baseUrl, entry);
  }

  update(id: string, entry: Partial<CreateBudgetEntryRequest>): Observable<BudgetEntry> {
    return this.http.put<BudgetEntry>(`${this.baseUrl}/${id}`, entry);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
