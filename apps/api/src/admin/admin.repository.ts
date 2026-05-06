import { Injectable } from '@nestjs/common';
import { Prisma, type AuditLog, type EmailLog } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

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

export type AuditLogWithRefs = AuditLog & {
  user: ResolvedUser | null;
  household: ResolvedHousehold | null;
};
export type EmailLogWithRefs = EmailLog & {
  user: ResolvedUser | null;
  household: ResolvedHousehold | null;
};

export interface AuditLogFilter {
  pageSize: number;
  cursor?: string | null;
  q?: string;
  actionPrefix?: string;
  action?: string;
  userId?: string;
  householdId?: string;
  from?: Date;
  to?: Date;
  toolName?: string;
  clientId?: string;
  ok?: boolean;
}

export interface EmailLogFilter {
  pageSize: number;
  cursor?: string | null;
  q?: string;
  status?: 'SENT' | 'FAILED';
  template?: string;
  householdId?: string;
  from?: Date;
  to?: Date;
}

export interface CursorPage<T> {
  data: T[];
  nextCursor: string | null;
  total: number | null;
}

interface DecodedCursor {
  ts: Date;
  id: string;
}

export function encodeCursor(ts: Date, id: string): string {
  return Buffer.from(`${ts.toISOString()}|${id}`, 'utf8').toString('base64url');
}

export function decodeCursor(cursor: string): DecodedCursor | null {
  try {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
    const [iso, id] = decoded.split('|');
    if (!iso || !id) return null;
    const ts = new Date(iso);
    if (Number.isNaN(ts.getTime())) return null;
    return { ts, id };
  } catch {
    return null;
  }
}

// JsonFilter is not exported from @prisma/client; use a permissive shape.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JsonPathFilter = { path: string[]; equals: any };

@Injectable()
export class AdminRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAuditLogs(filter: AuditLogFilter): Promise<CursorPage<AuditLogWithRefs>> {
    const where = this.buildAuditWhere(filter);
    const cursor = filter.cursor ? decodeCursor(filter.cursor) : null;
    const compositeWhere: Prisma.AuditLogWhereInput = cursor
      ? { AND: [where, this.cursorWhereByCreatedAt(cursor)] }
      : where;

    const take = filter.pageSize + 1;

    const rows = await this.prisma.auditLog.findMany({
      where: compositeWhere,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take,
    });

    const total = cursor ? null : await this.prisma.auditLog.count({ where });

    const hasMore = rows.length > filter.pageSize;
    const slice = hasMore ? rows.slice(0, filter.pageSize) : rows;
    const last = slice[slice.length - 1];
    const nextCursor = hasMore && last ? encodeCursor(last.createdAt, last.id) : null;

    const data = await this.attachAuditRefs(slice);
    return { data, nextCursor, total };
  }

  async findEmailLogs(filter: EmailLogFilter): Promise<CursorPage<EmailLogWithRefs>> {
    const where = this.buildEmailWhere(filter);
    const cursor = filter.cursor ? decodeCursor(filter.cursor) : null;
    const compositeWhere: Prisma.EmailLogWhereInput = cursor
      ? { AND: [where, this.cursorWhereBySentAt(cursor)] }
      : where;

    const take = filter.pageSize + 1;

    const rows = await this.prisma.emailLog.findMany({
      where: compositeWhere,
      orderBy: [{ sentAt: 'desc' }, { id: 'desc' }],
      take,
    });

    const total = cursor ? null : await this.prisma.emailLog.count({ where });

    const hasMore = rows.length > filter.pageSize;
    const slice = hasMore ? rows.slice(0, filter.pageSize) : rows;
    const last = slice[slice.length - 1];
    const nextCursor = hasMore && last ? encodeCursor(last.sentAt, last.id) : null;

    const refs = await this.fetchRefs(slice);
    const data = slice.map((row) => ({
      ...row,
      user: row.userId ? refs.users.get(row.userId) ?? null : null,
      household: row.householdId ? refs.households.get(row.householdId) ?? null : null,
    }));
    return { data, nextCursor, total };
  }

  async listHouseholdsWithMembers() {
    return this.prisma.household.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        memberships: {
          orderBy: { joinedAt: 'asc' },
          include: {
            user: {
              select: { id: true, displayName: true, email: true, avatarUrl: true },
            },
          },
        },
      },
    });
  }

  async resolveOAuthClientNames(clientIds: string[]): Promise<Map<string, string>> {
    if (clientIds.length === 0) return new Map();
    const rows = await this.prisma.oAuthClient.findMany({
      where: { clientId: { in: clientIds } },
      select: { clientId: true, displayName: true, clientName: true },
    });
    const map = new Map<string, string>();
    for (const row of rows) {
      map.set(row.clientId, row.displayName ?? row.clientName);
    }
    return map;
  }

  private async attachAuditRefs(rows: AuditLog[]): Promise<AuditLogWithRefs[]> {
    const refs = await this.fetchRefs(rows);
    return rows.map((row) => ({
      ...row,
      user: row.userId ? refs.users.get(row.userId) ?? null : null,
      household: row.householdId ? refs.households.get(row.householdId) ?? null : null,
    }));
  }

  private async fetchRefs(
    rows: Array<{ userId: string | null; householdId: string | null }>,
  ): Promise<{ users: Map<string, ResolvedUser>; households: Map<string, ResolvedHousehold> }> {
    const userIds = unique(rows.map((r) => r.userId).filter((x): x is string => !!x));
    const householdIds = unique(rows.map((r) => r.householdId).filter((x): x is string => !!x));

    const [users, households] = await Promise.all([
      userIds.length === 0
        ? Promise.resolve([])
        : this.prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, displayName: true, email: true, avatarUrl: true },
          }),
      householdIds.length === 0
        ? Promise.resolve([])
        : this.prisma.household.findMany({
            where: { id: { in: householdIds } },
            select: { id: true, name: true },
          }),
    ]);

    return {
      users: new Map(users.map((u) => [u.id, u])),
      households: new Map(households.map((h) => [h.id, h])),
    };
  }

  private buildAuditWhere(filter: AuditLogFilter): Prisma.AuditLogWhereInput {
    const where: Prisma.AuditLogWhereInput = {};
    const ands: Prisma.AuditLogWhereInput[] = [];

    if (filter.action) where.action = filter.action;
    else if (filter.actionPrefix && filter.q) {
      ands.push({ action: { startsWith: filter.actionPrefix } });
      ands.push({ action: { contains: filter.q, mode: 'insensitive' } });
    } else if (filter.actionPrefix) where.action = { startsWith: filter.actionPrefix };
    else if (filter.q) where.action = { contains: filter.q, mode: 'insensitive' };

    if (filter.userId) where.userId = filter.userId;
    if (filter.householdId) where.householdId = filter.householdId;
    if (filter.from || filter.to) {
      where.createdAt = {
        ...(filter.from ? { gte: filter.from } : {}),
        ...(filter.to ? { lte: filter.to } : {}),
      };
    }
    if (filter.toolName) {
      ands.push({
        metadata: { path: ['toolName'], equals: filter.toolName } as JsonPathFilter,
      });
    }
    if (filter.clientId) {
      ands.push({
        metadata: { path: ['clientId'], equals: filter.clientId } as JsonPathFilter,
      });
    }
    if (filter.ok !== undefined) {
      ands.push({
        metadata: { path: ['ok'], equals: filter.ok } as JsonPathFilter,
      });
    }
    if (ands.length > 0) where.AND = ands;
    return where;
  }

  private buildEmailWhere(filter: EmailLogFilter): Prisma.EmailLogWhereInput {
    const where: Prisma.EmailLogWhereInput = {};
    if (filter.status) where.status = filter.status;
    if (filter.template) where.template = filter.template;
    if (filter.householdId) where.householdId = filter.householdId;
    if (filter.q) {
      where.OR = [
        { to: { contains: filter.q, mode: 'insensitive' } },
        { subject: { contains: filter.q, mode: 'insensitive' } },
      ];
    }
    if (filter.from || filter.to) {
      where.sentAt = {
        ...(filter.from ? { gte: filter.from } : {}),
        ...(filter.to ? { lte: filter.to } : {}),
      };
    }
    return where;
  }

  private cursorWhereByCreatedAt(cursor: DecodedCursor): Prisma.AuditLogWhereInput {
    return {
      OR: [
        { createdAt: { lt: cursor.ts } },
        { AND: [{ createdAt: cursor.ts }, { id: { lt: cursor.id } }] },
      ],
    };
  }

  private cursorWhereBySentAt(cursor: DecodedCursor): Prisma.EmailLogWhereInput {
    return {
      OR: [
        { sentAt: { lt: cursor.ts } },
        { AND: [{ sentAt: cursor.ts }, { id: { lt: cursor.id } }] },
      ],
    };
  }
}

function unique<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}
