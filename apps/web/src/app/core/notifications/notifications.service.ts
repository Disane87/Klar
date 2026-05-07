import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

/** All notification kinds supported by the backend. */
export type NotificationKind =
  | 'CONTRACT_RENEWAL'
  | 'CONTRACT_PRICE_CHANGE'
  | 'RECURRING_DUE'
  | 'IMPORT_READY'
  | 'BUDGET_THRESHOLD'
  | 'MEMBER_INVITE'
  | 'SYSTEM';

export interface NotificationDto {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string | null;
  payloadJson: unknown;
  readAt: string | null;
  createdAt: string;
  userId: string | null;
}

export interface NotificationListResponse {
  items: NotificationDto[];
  nextCursor: string | null;
}

@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private http = inject(HttpClient);

  private base(householdId: string): string {
    return `/api/v1/households/${householdId}/notifications`;
  }

  list(
    householdId: string,
    opts: { cursor?: string; limit?: number; unreadOnly?: boolean } = {},
  ): Observable<NotificationListResponse> {
    const params: Record<string, string> = {};
    if (opts.cursor) params['cursor'] = opts.cursor;
    if (opts.limit !== undefined) params['limit'] = String(opts.limit);
    if (opts.unreadOnly) params['unreadOnly'] = 'true';
    return this.http.get<NotificationListResponse>(this.base(householdId), { params });
  }

  markRead(householdId: string, id: string): Observable<void> {
    return this.http.patch<void>(`${this.base(householdId)}/${id}/read`, {});
  }

  markAllRead(householdId: string): Observable<{ count: number }> {
    return this.http.patch<{ count: number }>(`${this.base(householdId)}/read-all`, {});
  }

  remove(householdId: string, id: string): Observable<void> {
    return this.http.delete<void>(`${this.base(householdId)}/${id}`);
  }
}
