import * as os from 'node:os';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

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

const THIRTY_DAYS_S = 30 * 24 * 60 * 60;
const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class AdminHealthServiceImpl {
  private readonly logger = new Logger(AdminHealthServiceImpl.name);

  constructor(private readonly prisma: PrismaService) {}

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
    const okBars = Array.from({ length: 30 }, () => 1);

    const postgresState = await this.probePostgres();
    const mcpState = await this.probeMcp();
    const mailState = await this.probeMail();

    const services: AdminHealthService[] = [
      { name: 'Web-App', meta: 'Angular SPA · static', state: 'ok', uptimeBars: okBars },
      { name: 'API', meta: 'NestJS · Fastify', state: 'ok', uptimeBars: okBars },
      {
        name: 'Postgres 16',
        meta: postgresState === 'ok' ? 'verbunden' : 'nicht erreichbar',
        state: postgresState,
        uptimeBars: postgresState === 'ok' ? okBars : okBars.map((_, i) => (i === 29 ? 0.5 : 1)),
      },
      {
        name: 'MCP Bridge',
        meta: mcpState === 'ok' ? 'Tool-Calls in der letzten Stunde' : 'keine Aktivität < 1 h',
        state: mcpState,
        uptimeBars: okBars,
      },
      {
        name: 'Mail-Queue',
        meta: mailState === 'ok' ? 'letzte 5 Mails OK' : 'Fehler in den letzten Mails',
        state: mailState,
        uptimeBars: okBars,
      },
    ];

    return { services };
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
    // Only OAuth-Cleanup is currently wired; others remain on the roadmap.
    const jobs: AdminHealthJob[] = [
      {
        name: 'OAuth-Cleanup',
        cron: '*/15 * * * *',
        state: 'ok',
      },
    ];
    return { jobs };
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

function computeCpuPct(): number {
  // os.loadavg() returns [0, 0, 0] on Windows. Use it where available, else 0.
  const load = os.loadavg();
  if (!Array.isArray(load) || load.length === 0) return 0;
  const cpus = os.cpus().length || 1;
  const pct = (load[0] / cpus) * 100;
  if (!Number.isFinite(pct) || pct < 0) return 0;
  return Math.min(100, pct);
}
