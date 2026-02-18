import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { Income, CreateIncomeRequest } from '../models/income.model';

/** Service for income CRUD operations. */
@Injectable({ providedIn: 'root' })
export class IncomeService {
  private readonly baseUrl = `${environment.apiUrl}/incomes`;

  constructor(private http: HttpClient) {}

  getAll(month?: number, year?: number): Observable<Income[]> {
    let params = new HttpParams();
    if (month) params = params.set('month', month);
    if (year) params = params.set('year', year);
    return this.http.get<Income[]>(this.baseUrl, { params });
  }

  create(income: CreateIncomeRequest): Observable<Income> {
    return this.http.post<Income>(this.baseUrl, income);
  }

  update(id: string, income: Partial<CreateIncomeRequest>): Observable<Income> {
    return this.http.put<Income>(`${this.baseUrl}/${id}`, income);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
