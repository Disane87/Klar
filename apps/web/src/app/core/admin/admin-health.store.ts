import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, resource, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

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

export interface AdminHealthDbQueryHistory {
  points: number[];
  peak: number;
  avg: number;
}

export type LiveLogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
export interface LiveLogEntry {
  ts: string;
  level: LiveLogLevel;
  msg: string;
  context?: string;
}
export interface AdminHealthLiveLogResponse {
  entries: LiveLogEntry[];
}

const REFRESH_INTERVAL_MS = 30_000;
const LIVE_LOG_LIMIT = 50;

/**
 * Admin telemetry store — polls /admin/health/* + /admin/jobs every 30 s.
 *
 * Pattern mirrors `NotificationStore`: single tick signal feeds four
 * `resource()` instances that each load on tick change.
 */
@Injectable({ providedIn: 'root' })
export class AdminHealthStore {
  private readonly http = inject(HttpClient);

  private readonly tick = signal(0);

  private readonly statusResource = resource<AdminHealthStatus | undefined, { tick: number }>({
    params: () => ({ tick: this.tick() }),
    loader: () =>
      firstValueFrom(this.http.get<AdminHealthStatus>('/api/v1/admin/health/status')),
  });

  private readonly servicesResource = resource<
    AdminHealthServicesResponse | undefined,
    { tick: number }
  >({
    params: () => ({ tick: this.tick() }),
    loader: () =>
      firstValueFrom(
        this.http.get<AdminHealthServicesResponse>('/api/v1/admin/health/services'),
      ),
  });

  private readonly performanceResource = resource<
    AdminHealthPerformanceResponse | undefined,
    { tick: number }
  >({
    params: () => ({ tick: this.tick() }),
    loader: () =>
      firstValueFrom(
        this.http.get<AdminHealthPerformanceResponse>('/api/v1/admin/health/performance'),
      ),
  });

  private readonly jobsResource = resource<
    AdminHealthJobsResponse | undefined,
    { tick: number }
  >({
    params: () => ({ tick: this.tick() }),
    loader: () =>
      firstValueFrom(this.http.get<AdminHealthJobsResponse>('/api/v1/admin/jobs')),
  });

  private readonly dbQueriesResource = resource<
    AdminHealthDbQueryHistory | undefined,
    { tick: number }
  >({
    params: () => ({ tick: this.tick() }),
    loader: () =>
      firstValueFrom(
        this.http.get<AdminHealthDbQueryHistory>('/api/v1/admin/health/db-queries'),
      ),
  });

  private readonly liveLogResource = resource<
    AdminHealthLiveLogResponse | undefined,
    { tick: number }
  >({
    params: () => ({ tick: this.tick() }),
    loader: () =>
      firstValueFrom(
        this.http.get<AdminHealthLiveLogResponse>(
          `/api/v1/admin/health/live-log?limit=${LIVE_LOG_LIMIT}`,
        ),
      ),
  });

  readonly status = computed(() => this.statusResource.value());
  readonly services = computed(() => this.servicesResource.value()?.services ?? []);
  readonly performance = computed(() => this.performanceResource.value()?.rows ?? []);
  readonly jobs = computed(() => this.jobsResource.value()?.jobs ?? []);
  readonly dbQueries = computed<AdminHealthDbQueryHistory>(
    () => this.dbQueriesResource.value() ?? { points: [], peak: 0, avg: 0 },
  );
  readonly liveLog = computed(() => this.liveLogResource.value()?.entries ?? []);

  readonly loading = computed(
    () =>
      this.statusResource.isLoading() ||
      this.servicesResource.isLoading() ||
      this.performanceResource.isLoading() ||
      this.jobsResource.isLoading(),
  );

  readonly heroState = computed<ServiceState>(() => {
    const list = this.services();
    if (list.some((s) => s.state === 'error')) return 'error';
    if (list.some((s) => s.state === 'warn')) return 'warn';
    return 'ok';
  });

  constructor() {
    if (typeof window !== 'undefined') {
      setInterval(() => this.tick.update((t) => t + 1), REFRESH_INTERVAL_MS);
    }
  }

  reload(): void {
    this.tick.update((t) => t + 1);
  }
}
