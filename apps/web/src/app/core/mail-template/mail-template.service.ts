import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export type MailTemplateType =
  | 'INVITE'
  | 'REMINDER'
  | 'CUSTOM'
  | 'EMAIL_VERIFY'
  | 'PASSWORD_RESET'
  | 'TOTP_ENABLE'
  | 'TOTP_DISABLE'
  | 'API_KEY_CREATED';

export interface HouseholdMailTemplate {
  id: string;
  householdId: string;
  templateType: MailTemplateType;
  name: string;
  subject: string;
  body: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMailTemplateRequest {
  templateType: MailTemplateType;
  name: string;
  subject: string;
  body: string;
}

export interface UpdateMailTemplateRequest {
  name?: string;
  subject?: string;
  body?: string;
}

@Injectable({ providedIn: 'root' })
export class MailTemplateService {
  private readonly http = inject(HttpClient);

  getTemplates(householdId: string, _userId: string): Promise<HouseholdMailTemplate[]> {
    return firstValueFrom(
      this.http.get<HouseholdMailTemplate[]>(`/api/v1/households/${householdId}/mail-templates`),
    );
  }

  getTemplate(
    householdId: string,
    _userId: string,
    type: MailTemplateType,
  ): Promise<HouseholdMailTemplate | null> {
    return firstValueFrom(
      this.http.get<HouseholdMailTemplate | null>(`/api/v1/households/${householdId}/mail-templates/${type}`),
    );
  }

  createTemplate(
    householdId: string,
    _userId: string,
    data: CreateMailTemplateRequest,
  ): Promise<HouseholdMailTemplate> {
    return firstValueFrom(
      this.http.post<HouseholdMailTemplate>(`/api/v1/households/${householdId}/mail-templates`, data),
    );
  }

  updateTemplate(
    householdId: string,
    _userId: string,
    type: MailTemplateType,
    data: UpdateMailTemplateRequest,
  ): Promise<HouseholdMailTemplate> {
    return firstValueFrom(
      this.http.patch<HouseholdMailTemplate>(`/api/v1/households/${householdId}/mail-templates/${type}`, data),
    );
  }

  deleteTemplate(householdId: string, _userId: string, type: MailTemplateType): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(`/api/v1/households/${householdId}/mail-templates/${type}`),
    );
  }
}