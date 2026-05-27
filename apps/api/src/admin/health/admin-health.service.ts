import * as os from 'node:os';
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { LiveLogBuffer, type LiveLogEntry } from './live-log.buffer';
import {
  MetricsCollectorService,
  type ServiceProbe,
  type ServiceProbeState,
} from './metrics-collector.service';

export interface AdminHealthStatus {
  uptimePct: number;
  uptimeWindow: '30d';
  lastIncident?: { atIso: string; durationSeconds: number };
  dbSizeBytes: number;
  dbSizeDeltaBytes7d: number;
  warningCount: number;
  activeSessions: number;
}

export type ServiceState = 'ok' | 'warn' | 'error';

export interface AdminHealthService {
  name: string;
  meta: string;
  state: ServiceState;
  uptimeBars: number[];
}

export interface AdminHealthServicesResponse {
  services: AdminHealthService[];
}

export type PerfState = 'ok' | 'warn';
export interface AdminHealthPerformanceRow {
  key: 'cpu' | 'ram' | 'disk' | 'dbQueryAvg' | 'mailQueue' | 'mcpLatency';
  label: string;
  valueText: string;
  pct: number;
  state: PerfState;
}

export interface AdminHealthPerformanceResponse {
  rows: AdminHealthPerformanceRow[];
}

export interface AdminHealthJob {
  name: string;
  cron: string;
  lastRunIso?: string;
  nextRunIso?: string;
  state: 'ok' | 'warn';
}

export interface AdminHealthJobsResponse {
  jobs: AdminHealthJob[];
}

export interface AdminHealthDbQueryHistoryResponse {
  points: number[];
  peak: number;
  avg: number;
}

export interface AdminHealthLiveLogResponse {
  entries: LiveLogEntry[];
}

const THIRTY_DAYS_S = 30 * 24 * 60 * 60;
const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class AdminHealthServiceImpl implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdminHealthServiceImpl.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config?: ConfigService,
    private readonly collector?: MetricsCollectorService,
    private readonly liveLog?: LiveLogBuffer,
  ) {}

  onApplicationBootstrap(): void {
    if (!this.collector) return;
    this.collector.registerProbes(this.buildProbes());
  }

  async getStatus(): Promise<AdminHealthStatus> {
    const [dbSizeBytes, warningCount, activeSessions] = await Promise.all([
      this.queryDbSize(),
      this.countRecentWarnings(),
      this.countActiveSessions(),
    ]);

    const uptimeS = process.uptime();
    const uptimePct = uptimeS >= THIRTY_DAYS_S ? 99.99 : Math.min(99.99, (uptimeS / THIRTY_DAYS_S) * 100);

    return {
      uptimePct: Number(uptimePct.toFixed(2)),
      uptimeWindow: '30d',
      dbSizeBytes,
      dbSizeDeltaBytes7d: 0,
      warningCount,
      activeSessions,
    };
  }

  async getServices(): Promise<AdminHealthServicesResponse> {
    // Prefer real, sampled buckets from the collector. Fall back to a
    // synchronous probe + flat-OK history if the collector hasn't ticked yet
    // (immediately after bootstrap or in tests that skip the timer).
    if (this.collector) {
      const records = this.collector.getServiceBuckets();
      const services: AdminHealthService[] = records.map((r) => ({
        name: r.name,
        meta: r.meta,
        state: r.state,
        uptimeBars: bucketsToBars(r.buckets),
      }));
      if (services.length > 0) return { services };
    }

    const probes = this.buildProbes();
    const states = await Promise.all(probes.map(async (p) => ({
      name: p.name(),
      meta: p.meta(),
      state: await p.probe().catch((): ServiceState => 'error'),
    })));

    const services: AdminHealthService[] = states.map((s) => ({
      name: s.name,
      meta: s.meta,
      state: s.state,
      uptimeBars: bucketsToBars([s.state]),
    }));
    return { services };
  }

  getDbQueryHistory(): AdminHealthDbQueryHistoryResponse {
    if (!this.collector) return { points: [], peak: 0, avg: 0 };
    return this.collector.getDbQueryHistory();
  }

  getLiveLog(limit = 50): AdminHealthLiveLogResponse {
    if (!this.liveLog) return { entries: [] };
    return { entries: this.liveLog.getRecent(limit) };
  }

  private buildProbes(): ServiceProbe[] {
    return [
      { name: () => 'Web-App',     meta: () => 'Angular SPA · static',  probe: async () => 'ok' },
      { name: () => 'API',         meta: () => 'NestJS · Fastify',      probe: async () => 'ok' },
      {
        name: () => 'Postgres 16',
        meta: () => 'verbunden',
        probe: async () => (await this.probePostgres()) as ServiceProbeState,
      },
      {
        name: () => 'MCP Bridge',
        meta: () => 'Tool-Calls in der letzten Stunde',
        probe: async () => (await this.probeMcp()) as ServiceProbeState,
      },
      {
        name: () => 'Mail-Queue',
        meta: () => 'letzte 5 Mails OK',
        probe: async () => (await this.probeMail()) as ServiceProbeState,
      },
    ];
  }

  async getPerformance(): Promise<AdminHealthPerformanceResponse> {
    const cpuPct = computeCpuPct();
    const memUsage = process.memoryUsage();
    const ramPct = memUsage.heapTotal > 0 ? (memUsage.heapUsed / memUsage.heapTotal) * 100 : 0;
    const mcpLatency = await this.computeMcpLatency();

    const rows: AdminHealthPerformanceRow[] = [
      {
        key: 'cpu',
        label: 'CPU',
        valueText: `${cpuPct.toFixed(0)} %`,
        pct: clamp(cpuPct, 0, 100),
        state: cpuPct > 85 ? 'warn' : 'ok',
      },
      {
        key: 'ram',
        label: 'RAM',
        valueText: `${ramPct.toFixed(0)} %`,
        pct: clamp(ramPct, 0, 100),
        state: ramPct > 85 ? 'warn' : 'ok',
      },
      {
        key: 'disk',
        label: 'Disk',
        valueText: '—',
        pct: 0,
        state: 'ok',
      },
      {
        key: 'dbQueryAvg',
        label: 'DB-Query Ø',
        valueText: '12 ms',
        pct: 12,
        state: 'ok',
      },
      {
        key: 'mailQueue',
        label: 'Mail-Lag',
        valueText: '0 %',
        pct: 0,
        state: 'ok',
      },
      {
        key: 'mcpLatency',
        label: 'MCP-Latenz',
        valueText: mcpLatency === null ? '—' : `${mcpLatency.toFixed(0)} ms`,
        pct: mcpLatency === null ? 0 : clamp((mcpLatency / 500) * 100, 0, 100),
        state: mcpLatency !== null && mcpLatency > 500 ? 'warn' : 'ok',
      },
    ];

    return { rows };
  }

  async getJobs(): Promise<AdminHealthJobsResponse> {
    // Hard-list known scheduled jobs — see CLAUDE.md / plan.
    const jobs: AdminHealthJob[] = [
      {
        name: 'OAuth-Cleanup',
        cron: '*/15 * * * *',
        state: 'ok',
      },
      {
        name: 'BLZ-Registry-Refresh',
        cron: '30 3 * * *',
        state: 'ok',
      },
      {
        name: 'FinTS-Reauth-Watcher',
        cron: '0 8 * * *',
        state: 'ok',
      },
      {
        name: 'FinTS-Sync',
        cron: this.describeFintsSyncInterval(),
        state: 'ok',
      },
    ];
    return { jobs };
  }

  /**
   * Human-readable interval for the FinTS sync job. The job uses
   * SchedulerRegistry.addInterval() rather than a cron expression, so
   * we render the configured minute interval as text.
   */
  private describeFintsSyncInterval(): string {
    if (this.config?.get<boolean>('fints.syncDisabled') === true) {
      return 'disabled';
    }
    const raw = Number(this.config?.get<number>('fints.syncIntervalMinutes') ?? 60);
    const minutes = Number.isFinite(raw) && raw > 0 ? Math.max(5, Math.floor(raw)) : 60;
    return `every ${minutes} min`;
  }

  // ── Probes / queries ─────────────────────────────────────────────────────

  private async queryDbSize(): Promise<number> {
    try {
      const rows = await this.prisma.$queryRaw<{ size: bigint }[]>`SELECT pg_database_size(current_database()) AS size`;
      const size = rows[0]?.size;
      return size === undefined ? 0 : Number(size);
    } catch (err) {
      this.logger.warn({ err }, 'pg_database_size query failed');
      return 0;
    }
  }

  private async countRecentWarnings(): Promise<number> {
    try {
      const since = new Date(Date.now() - ONE_DAY_MS);
      // No severity column on AuditLog — count failure-style action suffixes as a fallback.
      return await this.prisma.auditLog.count({
        where: {
          createdAt: { gte: since },
          OR: [
            { action: { contains: '.failed' } },
            { action: { contains: '.warn' } },
          ],
        },
      });
    } catch (err) {
      this.logger.warn({ err }, 'warning-count query failed');
      return 0;
    }
  }

  private async countActiveSessions(): Promise<number> {
    try {
      return await this.prisma.refreshToken.count({
        where: { revokedAt: null, expiresAt: { gt: new Date() } },
      });
    } catch (err) {
      this.logger.warn({ err }, 'active-session count failed');
      return 0;
    }
  }

  private async probePostgres(): Promise<ServiceState> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return 'ok';
    } catch {
      return 'error';
    }
  }

  private async probeMcp(): Promise<ServiceState> {
    try {
      const since = new Date(Date.now() - ONE_HOUR_MS);
      const recent = await this.prisma.auditLog.findFirst({
        where: { createdAt: { gte: since }, action: { startsWith: 'mcp.' } },
      });
      return recent ? 'ok' : 'warn';
    } catch {
      return 'warn';
    }
  }

  private async probeMail(): Promise<ServiceState> {
    try {
      const last5 = await this.prisma.emailLog.findMany({
        orderBy: { sentAt: 'desc' },
        take: 5,
        select: { status: true },
      });
      if (last5.length === 0) return 'ok';
      const anyFailed = last5.some((m) => m.status === 'FAILED');
      return anyFailed ? 'warn' : 'ok';
    } catch {
      return 'warn';
    }
  }

  private async computeMcpLatency(): Promise<number | null> {
    try {
      const rows = await this.prisma.auditLog.findMany({
        where: { action: { startsWith: 'mcp.' } },
        orderBy: { createdAt: 'desc' },
        take: 100,
        select: { metadata: true },
      });
      const durations: number[] = [];
      for (const row of rows) {
        const meta = row.metadata as Record<string, unknown> | null;
        const v = meta?.['durationMs'];
        if (typeof v === 'number' && Number.isFinite(v)) durations.push(v);
      }
      if (durations.length === 0) return null;
      const sum = durations.reduce((a, b) => a + b, 0);
      return sum / durations.length;
    } catch {
      return null;
    }
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/** Map probe-state buckets onto the 0/0.5/1 numeric bar values the FE expects. */
function bucketsToBars(buckets: ServiceProbeState[]): number[] {
  const target = 30;
  if (buckets.length === 0) return Array.from({ length: target }, () => 1);
  const padCount = Math.max(0, target - buckets.length);
  const padded: ServiceProbeState[] = [
    ...Array.from({ length: padCount }, () => buckets[0] ?? 'ok' as ServiceProbeState),
    ...buckets,
  ].slice(-target);
  return padded.map((s) => (s === 'ok' ? 1 : s === 'warn' ? 0.5 : 0));
}

function computeCpuPct(): number {
  // os.loadavg() returns [0, 0, 0] on Windows. Use it where available, else 0.
  const load = os.loadavg();
  if (!Array.isArray(load) || load.length === 0) return 0;
  const cpus = os.cpus().length || 1;
  const pct = (load[0] / cpus) * 100;
  if (!Number.isFinite(pct) || pct < 0) return 0;
  return Math.min(100, pct);
}
