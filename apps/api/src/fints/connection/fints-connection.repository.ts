import { Injectable } from '@nestjs/common';
import type { FintsConnection, FintsConnectionStatus, FintsSyncInterval } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Maps FintsSyncInterval enum → hours. MANUAL has no automatic cadence
 * (returns 0 — caller checks for MANUAL before scheduling).
 */
export function fintsSyncIntervalHours(interval: FintsSyncInterval): number {
  switch (interval) {
    case 'MANUAL': return 0;
    case 'H4':    return 4;
    case 'H6':    return 6;
    case 'H12':   return 12;
    case 'H24':   return 24;
    case 'H48':   return 48;
    case 'H168':  return 168;
  }
}

@Injectable()
export class FintsConnectionRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<FintsConnection | null> {
    return this.prisma.fintsConnection.findUnique({ where: { id } });
  }

  findAllActive(): Promise<FintsConnection[]> {
    return this.prisma.fintsConnection.findMany({
      where: { status: 'ACTIVE' },
    });
  }

  /**
   * ACTIVE connections eligible for a cron-driven sync now:
   *  - syncEnabled = true (user kill-switch off)
   *  - syncInterval != MANUAL (MANUAL only fires via "Sync now")
   *  - nextSyncAt <= now (or NULL — never synced via the per-connection
   *    cadence yet → catch up on this tick).
   *
   * Phase 8 — replaces the global FINTS_SYNC_INTERVAL_MINUTES knob with a
   * per-row schedule.
   */
  findDueForCronSync(now: Date): Promise<FintsConnection[]> {
    return this.prisma.fintsConnection.findMany({
      where: {
        status: 'ACTIVE',
        syncEnabled: true,
        syncInterval: { not: 'MANUAL' },
        OR: [{ nextSyncAt: null }, { nextSyncAt: { lte: now } }],
      },
    });
  }

  /**
   * Compute next sync time from the per-connection interval and stamp the
   * row. Called by the master tick after a successful cron-triggered sync.
   * Updates lastSyncAt + nextSyncAt in one round-trip.
   */
  async stampSync(id: string, now: Date, intervalHours: number): Promise<void> {
    const next = new Date(now.getTime() + intervalHours * 3_600_000);
    await this.prisma.fintsConnection.update({
      where: { id },
      data: { lastSyncAt: now, nextSyncAt: next },
    });
  }

  setSyncInterval(
    id: string,
    syncInterval: FintsSyncInterval,
    syncEnabled: boolean,
    now: Date = new Date(),
  ): Promise<FintsConnection> {
    const intervalHours = fintsSyncIntervalHours(syncInterval);
    const nextSyncAt =
      syncInterval === 'MANUAL' || !syncEnabled
        ? null
        : new Date(now.getTime() + intervalHours * 3_600_000);
    return this.prisma.fintsConnection.update({
      where: { id },
      data: { syncInterval, syncEnabled, nextSyncAt },
    });
  }

  /**
   * Connections whose SCA window expires within the next `withinDays`
   * days (and not already past). Used by the reauth watcher's 7-day
   * pre-warning pass.
   */
  findExpiringWithin(withinDays: number, now = new Date()): Promise<FintsConnection[]> {
    const upper = new Date(now.getTime() + withinDays * 86_400_000);
    return this.prisma.fintsConnection.findMany({
      where: {
        status: 'ACTIVE',
        scaExpiresAt: { gte: now, lte: upper },
      },
    });
  }

  /**
   * Connections whose SCA window has already expired but are still flagged
   * ACTIVE — the watcher flips them to REAUTH_REQUIRED on the next pass.
   */
  findExpired(now = new Date()): Promise<FintsConnection[]> {
    return this.prisma.fintsConnection.findMany({
      where: {
        status: 'ACTIVE',
        scaExpiresAt: { lt: now },
      },
    });
  }

  setStatus(id: string, status: FintsConnectionStatus): Promise<FintsConnection> {
    return this.prisma.fintsConnection.update({
      where: { id },
      data: { status },
    });
  }
}
