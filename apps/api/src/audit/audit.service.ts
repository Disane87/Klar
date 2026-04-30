import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditLogParams {
  userId?: string;
  householdId?: string;
  action: string;
  metadata?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Fire-and-forget — never blocks the request path. */
  log(params: AuditLogParams): void {
    const { metadata, ...rest } = params;
    this.prisma.auditLog
      .create({
        data: {
          ...rest,
          ...(metadata !== undefined && {
            metadata: metadata as Prisma.InputJsonValue,
          }),
        },
      })
      .catch((err: unknown) => {
        this.logger.warn({ err }, 'AuditLog write failed — non-fatal');
      });
  }
}
