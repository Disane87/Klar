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

const REFRESH_INTERVAL_MS = 30_000;

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

  readonly status = computed(() => this.statusResource.value());
  readonly services = computed(() => this.servicesResource.value()?.services ?? []);
  readonly performance = computed(() => this.performanceResource.value()?.rows ?? []);
  readonly jobs = computed(() => this.jobsResource.value()?.jobs ?? []);

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
