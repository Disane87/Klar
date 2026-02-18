import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import {
  Household,
  HouseholdMember,
  HouseholdSummary,
  HouseholdRole,
} from '../models/household.model';

/** Service for household management and shared financial overviews. */
@Injectable({ providedIn: 'root' })
export class HouseholdService {
  private readonly baseUrl = `${environment.apiUrl}/households`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<Household[]> {
    return this.http.get<Household[]>(this.baseUrl);
  }

  getOne(id: string): Observable<Household> {
    return this.http.get<Household>(`${this.baseUrl}/${id}`);
  }

  create(name: string): Observable<Household> {
    return this.http.post<Household>(this.baseUrl, { name });
  }

  join(inviteCode: string): Observable<Household> {
    return this.http.post<Household>(`${this.baseUrl}/join`, { inviteCode });
  }

  getMembers(householdId: string): Observable<HouseholdMember[]> {
    return this.http.get<HouseholdMember[]>(`${this.baseUrl}/${householdId}/members`);
  }

  getSummary(householdId: string, month: number, year: number): Observable<HouseholdSummary> {
    const params = new HttpParams().set('month', month).set('year', year);
    return this.http.get<HouseholdSummary>(`${this.baseUrl}/${householdId}/summary`, { params });
  }

  updateMemberRole(householdId: string, userId: string, role: HouseholdRole): Observable<HouseholdMember> {
    return this.http.put<HouseholdMember>(
      `${this.baseUrl}/${householdId}/members/${userId}`,
      { role },
    );
  }

  removeMember(householdId: string, userId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${householdId}/members/${userId}`);
  }
}
