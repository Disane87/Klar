import { Injectable } from '@nestjs/common';
import type {
  FintsSyncRun,
  FintsSyncStatus,
  FintsSyncTrigger,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface CreateSyncRunData {
  connectionId: string;
  triggeredBy: FintsSyncTrigger;
  triggeredById?: string | null;
  fromDate?: Date | null;
  toDate?: Date | null;
}

export interface UpdateSyncRunData {
  status?: FintsSyncStatus;
  finishedAt?: Date | null;
  bookingsFetched?: number;
  bookingsImported?: number;
  bookingsSkipped?: number;
  balanceDriftCents?: number | null;
  tanChallenge?: Prisma.InputJsonValue | null;
  errorCode?: string | null;
  errorMessage?: string | null;
}

@Injectable()
export class FintsSyncRunRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: CreateSyncRunData): Promise<FintsSyncRun> {
    return this.prisma.fintsSyncRun.create({
      data: {
        connectionId: data.connectionId,
        status: 'RUNNING',
        triggeredBy: data.triggeredBy,
        triggeredById: data.triggeredById ?? null,
        fromDate: data.fromDate ?? null,
        toDate: data.toDate ?? null,
      },
    });
  }

  findById(id: string): Promise<FintsSyncRun | null> {
    return this.prisma.fintsSyncRun.findUnique({ where: { id } });
  }

  /**
   * Connections in TAN_REQUIRED that have an unconsumed challenge — used
   * by the controller's TAN-submit endpoint to find the active run.
   */
  findActiveTanRequired(connectionId: string): Promise<FintsSyncRun | null> {
    return this.prisma.fintsSyncRun.findFirst({
      where: { connectionId, status: 'TAN_REQUIRED' },
      orderBy: { startedAt: 'desc' },
    });
  }

  /** Last run for a given connection — drives the rate-limit check. */
  findMostRecent(connectionId: string): Promise<FintsSyncRun | null> {
    return this.prisma.fintsSyncRun.findFirst({
      where: { connectionId },
      orderBy: { startedAt: 'desc' },
    });
  }

  update(id: string, data: UpdateSyncRunData): Promise<FintsSyncRun> {
    return this.prisma.fintsSyncRun.update({
      where: { id },
      data: data as Prisma.FintsSyncRunUpdateInput,
    });
  }
}
