import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export type ServiceProbeState = 'ok' | 'warn' | 'error';

export interface ServiceProbe {
  name(): string;
  meta(): string;
  probe(): Promise<ServiceProbeState>;
}

export interface ServiceBucketRecord {
  name: string;
  meta: string;
  state: ServiceProbeState;
  /** 30 most-recent probe results, oldest at index 0. */
  buckets: ServiceProbeState[];
}

export interface DbQueryHistory {
  /** Queries-per-minute samples, oldest at index 0. */
  points: number[];
  peak: number;
  avg: number;
}

const SAMPLE_INTERVAL_MS = 60 * 1000;
const HISTORY_SIZE = 30;

/**
 * Background sampler that powers the Admin "DB-Queries / Min." sparkline and
 * the per-service uptime buckets shown in the "Dienste" card. Runs every
 * minute via `setInterval` (mirrors `OAuthCleanupService` — keeps Klar free
 * of the `@nestjs/schedule` dependency for a single recurring job).
 *
 * State lives in process memory only: ring buffers reset on container
 * restart. For a self-host single-instance setup that is acceptable;
 * horizontal scaling would need to push samples into Postgres.
 */
@Injectable()
export class MetricsCollectorService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(MetricsCollectorService.name);
  private timer: NodeJS.Timeout | null = null;

  private readonly dbQueryPoints: number[] = [];
  private lastTotalQueries: number | null = null;

  private readonly serviceBuckets = new Map<string, ServiceBucketRecord>();
  private probes: ServiceProbe[] = [];

  constructor(private readonly prisma: PrismaService) {}

  registerProbes(probes: ServiceProbe[]): void {
    this.probes = probes;
    for (const p of probes) {
      if (!this.serviceBuckets.has(p.name())) {
        this.serviceBuckets.set(p.name(), {
          name: p.name(),
          meta: p.meta(),
          state: 'ok',
          buckets: [],
        });
      }
    }
  }

  onApplicationBootstrap(): void {
    if (process.env['NODE_ENV'] === 'test') return;
    // Prime once, then schedule.
    void this.sample();
    this.timer = setInterval(() => {
      void this.sample();
    }, SAMPLE_INTERVAL_MS);
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Take one snapshot. Public so tests can trigger it deterministically
   * without waiting for the setInterval timer.
   */
  async sample(): Promise<void> {
    await Promise.all([this.sampleDbQueries(), this.sampleServices()]);
  }

  getDbQueryHistory(): DbQueryHistory {
    const points = [...this.dbQueryPoints];
    if (points.length === 0) {
      return { points: [], peak: 0, avg: 0 };
    }
    const peak = points.reduce((a, b) => Math.max(a, b), 0);
    const sum = points.reduce((a, b) => a + b, 0);
    const avg = Math.round(sum / points.length);
    return { points, peak, avg };
  }

  getServiceBuckets(): ServiceBucketRecord[] {
    return Array.from(this.serviceBuckets.values()).map((r) => ({
      name: r.name,
      meta: r.meta,
      state: r.state,
      buckets: [...r.buckets],
    }));
  }

  private async sampleDbQueries(): Promise<void> {
    const total = await this.queryTotalQueries();
    if (total === null) return;
    if (this.lastTotalQueries === null) {
      this.lastTotalQueries = total;
      return;
    }
    const delta = Math.max(0, total - this.lastTotalQueries);
    this.lastTotalQueries = total;
    this.pushPoint(this.dbQueryPoints, delta);
  }

  private async queryTotalQueries(): Promise<number | null> {
    try {
      const rows = await this.prisma.$queryRaw<{ total: bigint }[]>`
        SELECT COALESCE(SUM(xact_commit), 0) + COALESCE(SUM(xact_rollback), 0) AS total
        FROM pg_stat_database
        WHERE datname = current_database()
      `;
      const total = rows[0]?.total;
      return total === undefined ? null : Number(total);
    } catch (err) {
      this.logger.warn({ err }, 'pg_stat_database query failed');
      return null;
    }
  }

  private async sampleServices(): Promise<void> {
    if (this.probes.length === 0) return;
    await Promise.all(
      this.probes.map(async (probe) => {
        const name = probe.name();
        let state: ServiceProbeState;
        try {
          state = await probe.probe();
        } catch {
          state = 'error';
        }
        const record = this.serviceBuckets.get(name);
        if (!record) return;
        record.meta = probe.meta();
        record.state = state;
        this.pushBucket(record.buckets, state);
      }),
    );
  }

  private pushPoint(arr: number[], value: number): void {
    arr.push(value);
    if (arr.length > HISTORY_SIZE) arr.splice(0, arr.length - HISTORY_SIZE);
  }

  private pushBucket(arr: ServiceProbeState[], value: ServiceProbeState): void {
    arr.push(value);
    if (arr.length > HISTORY_SIZE) arr.splice(0, arr.length - HISTORY_SIZE);
  }
}
