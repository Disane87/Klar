import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export type ProjectStatus = 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';
export type Visibility = 'SHARED' | 'PRIVATE';

export interface CreateProjectRequest {
  name:              string;
  color:             string;
  description?:      string | null;
  status?:           ProjectStatus;
  totalBudgetCents?: number | null;
  startDate?:        string | null;
  endDate?:          string | null;
  visibility?:       Visibility;
}

export type UpdateProjectRequest = Partial<CreateProjectRequest>;

export interface ProjectResponse {
  id:               string;
  householdId:      string;
  createdByUserId:  string;
  name:             string;
  description:      string | null;
  status:           ProjectStatus;
  totalBudgetCents: number | null;
  startDate:        string | null;
  endDate:          string | null;
  color:            string;
  visibility:       Visibility;
  createdAt:        string;
  updatedAt:        string;
}

@Injectable({ providedIn: 'root' })
export class ProjectsService {
  private http = inject(HttpClient);

  create(householdId: string, body: CreateProjectRequest): Promise<ProjectResponse> {
    return firstValueFrom(
      this.http.post<ProjectResponse>(
        `/api/v1/households/${householdId}/projects`,
        body,
      ),
    );
  }

  patch(householdId: string, id: string, body: UpdateProjectRequest): Promise<ProjectResponse> {
    return firstValueFrom(
      this.http.patch<ProjectResponse>(
        `/api/v1/households/${householdId}/projects/${id}`,
        body,
      ),
    );
  }

  delete(householdId: string, id: string): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(
        `/api/v1/households/${householdId}/projects/${id}`,
      ),
    );
  }
}
