import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AuditLogEntry {
  id: string;
  userId: string | null;
  householdId: string | null;
  action: string;
  metadata: unknown;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface EmailLogEntry {
  id: string;
  to: string;
  subject: string;
  template: string;
  status: 'SENT' | 'FAILED';
  error: string | null;
  userId: string | null;
  householdId: string | null;
  sentAt: string;
}

export interface AdminHouseholdMember {
  userId: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
  role: 'OWNER' | 'MEMBER';
  joinedAt: string;
}

export interface AdminHousehold {
  id: string;
  name: string;
  createdAt: string;
  members: AdminHouseholdMember[];
}

function toParams(obj: Record<string, unknown>): HttpParams {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(obj)) {
    if (value !== null && value !== undefined && value !== '') {
      params = params.set(key, String(value));
    }
  }
  return params;
}

@Injectable({ providedIn: 'root' })
export class AdminApiService {
  private http = inject(HttpClient);

  listAuditLogs(params: { page?: number; pageSize?: number; action?: string; householdId?: string } = {}) {
    return firstValueFrom(
      this.http.get<PaginatedResponse<AuditLogEntry>>('/api/v1/admin/audit-logs', {
        params: toParams(params),
      }),
    );
  }

  listEmails(params: { page?: number; pageSize?: number; status?: 'SENT' | 'FAILED'; householdId?: string } = {}) {
    return firstValueFrom(
      this.http.get<PaginatedResponse<EmailLogEntry>>('/api/v1/admin/emails', {
        params: toParams(params),
      }),
    );
  }

  listHouseholds() {
    return firstValueFrom(this.http.get<AdminHousehold[]>('/api/v1/admin/households'));
  }
}
