import { Injectable } from '@nestjs/common';
import {
  AdminRepository,
  type AuditLogFilter,
  type AuditLogWithRefs,
  type CursorPage,
  type EmailLogFilter,
  type EmailLogWithRefs,
  type ResolvedHousehold,
  type ResolvedUser,
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

export interface AuditLogDto {
  id: string;
  createdAt: string;
  action: string;
  ip: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown> | null;
  user: ResolvedUser | null;
  household: ResolvedHousehold | null;
}

export interface McpAuditLogDto extends AuditLogDto {
  toolName: string | null;
  clientId: string | null;
  clientName: string | null;
  durationMs: number | null;
  ok: boolean | null;
  errorCode: string | null;
}

export interface EmailLogDto {
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

@Injectable()
export class AdminService {
  constructor(private readonly repo: AdminRepository) {}

  async listAuditLogs(filter: AuditLogFilter): Promise<CursorPage<AuditLogDto>> {
    const page = await this.repo.findAuditLogs(filter);
    return { ...page, data: page.data.map((row) => this.toAuditDto(row)) };
  }

  async listMcpAuditLogs(filter: AuditLogFilter): Promise<CursorPage<McpAuditLogDto>> {
    const page = await this.repo.findAuditLogs({ ...filter, actionPrefix: 'mcp.' });
    const clientIds = uniqueClientIds(page.data);
    const clientNames = await this.repo.resolveOAuthClientNames(clientIds);
    return { ...page, data: page.data.map((row) => this.toMcpDto(row, clientNames)) };
  }

  async listEmailLogs(filter: EmailLogFilter): Promise<CursorPage<EmailLogDto>> {
    const page = await this.repo.findEmailLogs(filter);
    return { ...page, data: page.data.map((row) => this.toEmailDto(row)) };
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

  toAuditDto(row: AuditLogWithRefs): AuditLogDto {
    return {
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      action: row.action,
      ip: row.ip,
      userAgent: row.userAgent,
      metadata: (row.metadata as Record<string, unknown> | null) ?? null,
      user: row.user,
      household: row.household,
    };
  }

  toMcpDto(row: AuditLogWithRefs, clientNames: Map<string, string>): McpAuditLogDto {
    const base = this.toAuditDto(row);
    const meta = base.metadata ?? {};
    const clientId = stringOrNull(meta.clientId);
    return {
      ...base,
      toolName: stringOrNull(meta.toolName),
      clientId,
      clientName: clientId ? clientNames.get(clientId) ?? null : null,
      durationMs: numberOrNull(meta.durationMs),
      ok: booleanOrNull(meta.ok),
      errorCode: stringOrNull(meta.errorCode),
    };
  }

  toEmailDto(row: EmailLogWithRefs): EmailLogDto {
    return {
      id: row.id,
      sentAt: row.sentAt.toISOString(),
      to: row.to,
      subject: row.subject,
      template: row.template,
      status: row.status,
      error: row.error,
      user: row.user,
      household: row.household,
    };
  }
}

function uniqueClientIds(rows: AuditLogWithRefs[]): string[] {
  const set = new Set<string>();
  for (const row of rows) {
    const meta = (row.metadata as Record<string, unknown> | null) ?? null;
    if (meta && typeof meta.clientId === 'string') set.add(meta.clientId);
  }
  return Array.from(set);
}

function stringOrNull(v: unknown): string | null {
  return typeof v === 'string' ? v : null;
}
function numberOrNull(v: unknown): number | null {
  return typeof v === 'number' ? v : null;
}
function booleanOrNull(v: unknown): boolean | null {
  return typeof v === 'boolean' ? v : null;
}
