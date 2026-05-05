import { Injectable } from '@nestjs/common';
import type { AuditLog, EmailLog } from '@prisma/client';
import {
  AdminRepository,
  type AuditLogFilter,
  type EmailLogFilter,
  type PageResult,
} from './admin.repository';

export interface HouseholdSummary {
  id: string;
  name: string;
  createdAt: string;
  members: Array<{
    userId: string;
    displayName: string;
    email: string;
    avatarUrl: string | null;
    role: 'OWNER' | 'MEMBER';
    joinedAt: string;
  }>;
}

@Injectable()
export class AdminService {
  constructor(private readonly repo: AdminRepository) {}

  listAuditLogs(filter: AuditLogFilter): Promise<PageResult<AuditLog>> {
    return this.repo.findAuditLogs(filter);
  }

  listEmailLogs(filter: EmailLogFilter): Promise<PageResult<EmailLog>> {
    return this.repo.findEmailLogs(filter);
  }

  async listHouseholds(): Promise<HouseholdSummary[]> {
    const rows = await this.repo.listHouseholdsWithMembers();
    return rows.map((h) => ({
      id: h.id,
      name: h.name,
      createdAt: h.createdAt.toISOString(),
      members: h.memberships.map((m) => ({
        userId: m.user.id,
        displayName: m.user.displayName,
        email: m.user.email,
        avatarUrl: m.user.avatarUrl,
        role: m.role,
        joinedAt: m.joinedAt.toISOString(),
      })),
    }));
  }

  toAuditResponse(log: AuditLog) {
    return {
      id: log.id,
      userId: log.userId,
      householdId: log.householdId,
      action: log.action,
      metadata: log.metadata,
      ip: log.ip,
      userAgent: log.userAgent,
      createdAt: log.createdAt.toISOString(),
    };
  }

  toEmailResponse(log: EmailLog) {
    return {
      id: log.id,
      to: log.to,
      subject: log.subject,
      template: log.template,
      status: log.status,
      error: log.error,
      userId: log.userId,
      householdId: log.householdId,
      sentAt: log.sentAt.toISOString(),
    };
  }
}
