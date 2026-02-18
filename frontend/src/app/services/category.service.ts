import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { BudgetCategory, CreateCategoryRequest } from '../models/category.model';

/** Service for budget category CRUD operations. */
@Injectable({ providedIn: 'root' })
export class CategoryService {
  private readonly baseUrl = `${environment.apiUrl}/categories`;

  constructor(private http: HttpClient) {}

  getAll(householdId?: string): Observable<BudgetCategory[]> {
    let params = new HttpParams();
    if (householdId) params = params.set('householdId', householdId);
    return this.http.get<BudgetCategory[]>(this.baseUrl, { params });
  }

  create(category: CreateCategoryRequest): Observable<BudgetCategory> {
    return this.http.post<BudgetCategory>(this.baseUrl, category);
  }

  update(id: string, category: Partial<CreateCategoryRequest>): Observable<BudgetCategory> {
    return this.http.put<BudgetCategory>(`${this.baseUrl}/${id}`, category);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
