import { Injectable } from '@nestjs/common';
import { Prisma, type AuditLog, type EmailLog } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditLogFilter {
  page: number;
  pageSize: number;
  action?: string;
  householdId?: string;
  userId?: string;
}

export interface EmailLogFilter {
  page: number;
  pageSize: number;
  status?: 'SENT' | 'FAILED';
  householdId?: string;
}

export interface PageResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

@Injectable()
export class AdminRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAuditLogs(filter: AuditLogFilter): Promise<PageResult<AuditLog>> {
    const where: Prisma.AuditLogWhereInput = {};
    if (filter.action) where.action = filter.action;
    if (filter.householdId) where.householdId = filter.householdId;
    if (filter.userId) where.userId = filter.userId;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { data, total, page: filter.page, pageSize: filter.pageSize };
  }

  async findEmailLogs(filter: EmailLogFilter): Promise<PageResult<EmailLog>> {
    const where: Prisma.EmailLogWhereInput = {};
    if (filter.status) where.status = filter.status;
    if (filter.householdId) where.householdId = filter.householdId;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.emailLog.findMany({
        where,
        orderBy: { sentAt: 'desc' },
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
      }),
      this.prisma.emailLog.count({ where }),
    ]);

    return { data, total, page: filter.page, pageSize: filter.pageSize };
  }

  async listHouseholdsWithMembers() {
    return this.prisma.household.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        memberships: {
          orderBy: { joinedAt: 'asc' },
          include: {
            user: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
          },
        },
      },
    });
  }
}
