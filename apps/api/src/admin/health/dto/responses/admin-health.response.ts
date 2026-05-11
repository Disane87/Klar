import { ApiProperty } from '@nestjs/swagger';

export class AdminHealthLastIncident {
  @ApiProperty({ example: '2026-05-08T12:30:00.000Z' })
  atIso!: string;

  @ApiProperty({ description: 'Incident duration in seconds.', example: 320 })
  durationSeconds!: number;
}

export class AdminHealthStatusResponse {
  @ApiProperty({ description: 'Uptime percentage in the rolling window.', example: 99.95 })
  uptimePct!: number;

  @ApiProperty({ enum: ['30d'], example: '30d' })
  uptimeWindow!: '30d';

  @ApiProperty({ type: AdminHealthLastIncident, required: false })
  lastIncident?: AdminHealthLastIncident;

  @ApiProperty({ description: 'Database size in bytes.', example: 184320000 })
  dbSizeBytes!: number;

  @ApiProperty({ description: 'Database size delta over the last 7 days, in bytes.', example: 1048576 })
  dbSizeDeltaBytes7d!: number;

  @ApiProperty({ example: 0 })
  warningCount!: number;

  @ApiProperty({ example: 3 })
  activeSessions!: number;
}

export class AdminHealthServiceRow {
  @ApiProperty({ example: 'PostgreSQL' })
  name!: string;

  @ApiProperty({ description: 'Free-form status meta line.', example: 'p99 latency 12ms' })
  meta!: string;

  @ApiProperty({ enum: ['ok', 'warn', 'error'], example: 'ok' })
  state!: 'ok' | 'warn' | 'error';

  @ApiProperty({
    description: 'Bar values (0..1) for a 30-bar uptime sparkline.',
    type: 'array',
    items: { type: 'number' },
    example: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  })
  uptimeBars!: number[];
}

export class AdminHealthServicesResponse {
  @ApiProperty({ type: AdminHealthServiceRow, isArray: true })
  services!: AdminHealthServiceRow[];
}

export class AdminHealthPerformanceRow {
  @ApiProperty({ enum: ['cpu', 'ram', 'disk', 'dbQueryAvg', 'mailQueue', 'mcpLatency'], example: 'cpu' })
  key!: 'cpu' | 'ram' | 'disk' | 'dbQueryAvg' | 'mailQueue' | 'mcpLatency';

  @ApiProperty({ example: 'CPU' })
  label!: string;

  @ApiProperty({ description: 'Human-readable value.', example: '23%' })
  valueText!: string;

  @ApiProperty({ description: 'Normalized value 0..100.', example: 23 })
  pct!: number;

  @ApiProperty({ enum: ['ok', 'warn'], example: 'ok' })
  state!: 'ok' | 'warn';
}

export class AdminHealthPerformanceResponse {
  @ApiProperty({ type: AdminHealthPerformanceRow, isArray: true })
  rows!: AdminHealthPerformanceRow[];
}

export class AdminHealthJobRow {
  @ApiProperty({ example: 'fints.sync' })
  name!: string;

  @ApiProperty({ example: '0 */6 * * *' })
  cron!: string;

  @ApiProperty({ required: false, example: '2026-05-10T06:00:00.000Z' })
  lastRunIso?: string;

  @ApiProperty({ required: false, example: '2026-05-10T12:00:00.000Z' })
  nextRunIso?: string;

  @ApiProperty({ enum: ['ok', 'warn'], example: 'ok' })
  state!: 'ok' | 'warn';
}

export class AdminHealthJobsResponse {
  @ApiProperty({ type: AdminHealthJobRow, isArray: true })
  jobs!: AdminHealthJobRow[];
}

export class AdminHealthDbQueryHistoryResponse {
  @ApiProperty({
    description: 'Per-bucket average query latency in ms.',
    type: 'array',
    items: { type: 'number' },
    example: [12, 14, 13, 11, 15, 12, 13],
  })
  points!: number[];

  @ApiProperty({ description: 'Peak observed latency in ms.', example: 84 })
  peak!: number;

  @ApiProperty({ description: 'Average latency in ms.', example: 13.2 })
  avg!: number;
}

export class AdminHealthLiveLogEntry {
  @ApiProperty({ example: '2026-05-10T08:30:00.000Z' })
  timestamp!: string;

  @ApiProperty({ enum: ['debug', 'info', 'warn', 'error', 'fatal'], example: 'info' })
  level!: string;

  @ApiProperty({ example: 'Auth: user logged in' })
  message!: string;

  @ApiProperty({ required: false, nullable: true, example: 'AuthService' })
  context?: string | null;
}

export class AdminHealthLiveLogResponse {
  @ApiProperty({ type: AdminHealthLiveLogEntry, isArray: true })
  entries!: AdminHealthLiveLogEntry[];
}
