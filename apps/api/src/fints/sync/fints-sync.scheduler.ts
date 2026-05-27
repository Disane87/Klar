import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { FintsConnectionRepository } from '../connection/fints-connection.repository';
import { FintsSyncRunRepository } from './fints-sync-run.repository';
import { FintsSyncService } from './fints-sync.service';

/**
 * Automatic FinTS sync cron (Phase 14a.7-final).
 *
 * Runs on a configurable interval (default 60 minutes, minimum 5) and
 * triggers a CRON-scoped sync for every connection in ACTIVE state.
 * Connections in SETUP / TAN_REQUIRED / REAUTH_REQUIRED / DISABLED /
 * ERROR are filtered upstream by {@link FintsConnectionRepository.findAllActive}.
 *
 * Per-connection guards:
 *  - Skip if a previous run is still RUNNING or TAN_REQUIRED — we don't
 *    stack ticks on a connection that's still working on the prior batch
 *    or waiting on the user's TAN input.
 *  - Catch and log per-connection failures so a single bad connection
 *    cannot abort the whole tick.
 *
 * Configuration:
 *  - FINTS_SYNC_INTERVAL_MINUTES (default 60, floored to >= 5)
 *  - FINTS_SYNC_DISABLED=true   to disable the cron entirely
 */
@Injectable()
export class FintsSyncScheduler
  implements OnApplicationBootstrap, OnModuleDestroy
{
  static readonly JOB_NAME = 'fints-sync';
  static readonly MIN_INTERVAL_MINUTES = 5;
  static readonly DEFAULT_INTERVAL_MINUTES = 60;

  private readonly logger = new Logger(FintsSyncScheduler.name);
  private readonly intervalMinutes: number;
  /** Re-entrancy guard against an overlapping next tick. */
  private inFlight = false;

  constructor(
    private readonly registry: SchedulerRegistry,
    private readonly config: ConfigService,
    private readonly connections: FintsConnectionRepository,
    private readonly syncRuns: FintsSyncRunRepository,
    private readonly sync: FintsSyncService,
  ) {
    this.intervalMinutes = this.resolveIntervalMinutes();
  }

  onApplicationBootstrap(): void {
    if (process.env['NODE_ENV'] === 'test') return;
    if (this.config.get<boolean>('fints.syncDisabled') === true) {
      this.logger.log('FinTS sync cron disabled via FINTS_SYNC_DISABLED');
      return;
    }
    const intervalMs = this.intervalMinutes * 60_000;
    const handle = setInterval(() => {
      void this.tick();
    }, intervalMs);
    this.registry.addInterval(FintsSyncScheduler.JOB_NAME, handle);
    this.logger.log(
      `FinTS sync cron armed: every ${this.intervalMinutes} minute(s)`,
    );
  }

  onModuleDestroy(): void {
    try {
      this.registry.deleteInterval(FintsSyncScheduler.JOB_NAME);
    } catch {
      // Not armed (test path / disabled) — nothing to clean up.
    }
  }

  getIntervalMinutes(): number {
    return this.intervalMinutes;
  }

  /**
   * One scheduler tick: iterate every ACTIVE connection and kick off a
   * CRON-scoped sync. Returns counters for visibility in tests/logs.
   */
  async tick(): Promise<TickSummary> {
    if (this.inFlight) {
      this.logger.debug('Previous FinTS sync tick still running, skipping');
      return { started: 0, skipped: 0, failed: 0, total: 0 };
    }
    this.inFlight = true;
    try {
      const connections = await this.connections.findAllActive();
      let started = 0;
      let skipped = 0;
      let failed = 0;
      for (const c of connections) {
        const blocking = await this.syncRuns.findRunning(c.id);
        if (blocking) {
          skipped++;
          continue;
        }
        try {
          await this.sync.start(c.id, {
            triggeredBy: 'CRON',
            triggeredById: null,
          });
          started++;
        } catch (err) {
          failed++;
          this.logger.warn(
            {
              err: err instanceof Error ? err.message : String(err),
              connectionId: c.id,
            },
            'FinTS cron sync failed for connection',
          );
        }
      }
      if (connections.length > 0) {
        this.logger.log(
          `FinTS sync cron tick: started=${started}, skipped=${skipped}, failed=${failed}, total=${connections.length}`,
        );
      }
      return { started, skipped, failed, total: connections.length };
    } finally {
      this.inFlight = false;
    }
  }

  private resolveIntervalMinutes(): number {
    const configured = Number(
      this.config.get<number>('fints.syncIntervalMinutes') ??
        FintsSyncScheduler.DEFAULT_INTERVAL_MINUTES,
    );
    if (!Number.isFinite(configured) || configured <= 0) {
      return FintsSyncScheduler.DEFAULT_INTERVAL_MINUTES;
    }
    return Math.max(
      FintsSyncScheduler.MIN_INTERVAL_MINUTES,
      Math.floor(configured),
    );
  }
}

export interface TickSummary {
  started: number;
  skipped: number;
  failed: number;
  total: number;
}
