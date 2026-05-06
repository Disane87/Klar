import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export interface CursorPage<T> {
  data: T[];
  nextCursor: string | null;
  total: number | null;
}

export interface ResolvedUser {
  id: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
}
export interface ResolvedHousehold {
  id: string;
  name: string;
}

export interface AuditLogEntry {
  id: string;
  createdAt: string;
  action: string;
  ip: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown> | null;
  user: ResolvedUser | null;
  household: ResolvedHousehold | null;
}

export interface McpAuditEntry extends AuditLogEntry {
  toolName: string | null;
  clientId: string | null;
  clientName: string | null;
  durationMs: number | null;
  ok: boolean | null;
  errorCode: string | null;
}

export interface EmailLogEntry {
  id: string;
  sentAt: string;
  to: string;
  subject: string;
  template: string;
  status: 'SENT' | 'FAILED';
  error: string | null;
  user: ResolvedUser | null;
  household: ResolvedHousehold | null;
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

export interface AuditFilter {
  q?: string;
  actionPrefix?: string;
  userId?: string;
  householdId?: string;
  from?: string;
  to?: string;
}

export interface McpFilter {
  q?: string;
  userId?: string;
  householdId?: string;
  toolName?: string;
  clientId?: string;
  ok?: boolean | null;
  from?: string;
  to?: string;
}

export interface EmailFilter {
  q?: string;
  status?: 'SENT' | 'FAILED' | null;
  template?: string;
  householdId?: string;
  from?: string;
  to?: string;
}

function toParams(obj: Record<string, unknown>, cursor: string | null, pageSize: number): HttpParams {
  let params = new HttpParams().set('pageSize', String(pageSize));
  if (cursor) params = params.set('cursor', cursor);
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) continue;
    const str = String(value);
    if (str.length === 0) continue;
    params = params.set(key, str);
  }
  return params;
}

@Injectable({ providedIn: 'root' })
export class AdminApiService {
  private http = inject(HttpClient);

  listAuditLogs(filter: AuditFilter, cursor: string | null, pageSize = 50) {
    return firstValueFrom(
      this.http.get<CursorPage<AuditLogEntry>>('/api/v1/admin/audit-logs', {
        params: toParams({ ...filter }, cursor, pageSize),
      }),
    );
  }

  listMcpAuditLogs(filter: McpFilter, cursor: string | null, pageSize = 50) {
    return firstValueFrom(
      this.http.get<CursorPage<McpAuditEntry>>('/api/v1/admin/mcp', {
        params: toParams({ ...filter }, cursor, pageSize),
      }),
    );
  }

  listEmails(filter: EmailFilter, cursor: string | null, pageSize = 50) {
    return firstValueFrom(
      this.http.get<CursorPage<EmailLogEntry>>('/api/v1/admin/emails', {
        params: toParams({ ...filter }, cursor, pageSize),
      }),
    );
  }

  listHouseholds() {
    return firstValueFrom(this.http.get<AdminHousehold[]>('/api/v1/admin/households'));
  }
}
