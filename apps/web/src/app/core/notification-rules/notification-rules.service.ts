import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import type {
  DigestMode,
  NotificationChannel,
  NotificationTrigger,
  Predicate,
  Schedule,
} from '@klar/shared';

export interface NotificationRuleDto {
  id: string;
  householdId: string;
  userId: string;
  name: string;
  enabled: boolean;
  trigger: NotificationTrigger;
  predicate: Predicate;
  schedule: Schedule | null;
  leadTimeDays: number | null;
  channels: NotificationChannel[];
  digestMode: DigestMode;
  cooldownMinutes: number | null;
  maxPerHour: number | null;
  maxPerDay: number | null;
  lastFiredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateNotificationRuleInput {
  name: string;
  enabled?: boolean;
  trigger: NotificationTrigger;
  predicate: Predicate;
  schedule?: Schedule;
  leadTimeDays?: number;
  channels: NotificationChannel[];
  digestMode?: DigestMode;
  cooldownMinutes?: number;
  maxPerHour?: number;
  maxPerDay?: number;
}

export type UpdateNotificationRuleInput = Partial<CreateNotificationRuleInput>;

export interface RulePreviewInput {
  trigger: NotificationTrigger;
  predicate: Predicate;
  days?: number;
}

export interface RulePreviewResponse {
  wouldHaveFiredCount: number;
  sample: Array<{ at: string; title: string; amountCents: number }>;
}

export interface RuleActivityItemDto {
  id: string;
  ruleId: string;
  sourceKind: string;
  sourceId: string;
  firedAt: string;
  channelsSent: NotificationChannel[];
  notificationId: string | null;
}

@Injectable({ providedIn: 'root' })
export class NotificationRulesService {
  private readonly http = inject(HttpClient);

  private base(householdId: string): string {
    return `/api/v1/households/${householdId}/notification-rules`;
  }

  list(householdId: string): Observable<NotificationRuleDto[]> {
    return this.http.get<NotificationRuleDto[]>(this.base(householdId));
  }

  get(householdId: string, id: string): Observable<NotificationRuleDto> {
    return this.http.get<NotificationRuleDto>(`${this.base(householdId)}/${id}`);
  }

  create(
    householdId: string,
    input: CreateNotificationRuleInput,
  ): Observable<NotificationRuleDto> {
    return this.http.post<NotificationRuleDto>(this.base(householdId), input);
  }

  update(
    householdId: string,
    id: string,
    input: UpdateNotificationRuleInput,
  ): Observable<NotificationRuleDto> {
    return this.http.patch<NotificationRuleDto>(`${this.base(householdId)}/${id}`, input);
  }

  remove(householdId: string, id: string): Observable<void> {
    return this.http.delete<void>(`${this.base(householdId)}/${id}`);
  }

  preview(
    householdId: string,
    input: RulePreviewInput,
  ): Observable<RulePreviewResponse> {
    return this.http.post<RulePreviewResponse>(`${this.base(householdId)}/preview`, input);
  }

  test(
    householdId: string,
    id: string,
  ): Observable<{ dispatched: boolean; channels: NotificationChannel[] }> {
    return this.http.post<{ dispatched: boolean; channels: NotificationChannel[] }>(
      `${this.base(householdId)}/${id}/test`,
      {},
    );
  }

  activity(
    householdId: string,
    limit = 50,
  ): Observable<{ items: RuleActivityItemDto[] }> {
    return this.http.get<{ items: RuleActivityItemDto[] }>(
      `${this.base(householdId)}/activity`,
      { params: { limit: String(limit) } },
    );
  }
}
