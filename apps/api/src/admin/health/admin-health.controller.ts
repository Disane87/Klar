import { Controller, DefaultValuePipe, Get, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AppAdminGuard } from '../../common/guards/app-admin.guard';
import {
  AdminHealthServiceImpl,
  type AdminHealthDbQueryHistoryResponse,
  type AdminHealthJobsResponse,
  type AdminHealthLiveLogResponse,
  type AdminHealthPerformanceResponse,
  type AdminHealthServicesResponse,
  type AdminHealthStatus,
} from './admin-health.service';
import {
  AdminHealthDbQueryHistoryResponse as AdminHealthDbQueryHistoryResponseDto,
  AdminHealthJobsResponse as AdminHealthJobsResponseDto,
  AdminHealthLiveLogResponse as AdminHealthLiveLogResponseDto,
  AdminHealthPerformanceResponse as AdminHealthPerformanceResponseDto,
  AdminHealthServicesResponse as AdminHealthServicesResponseDto,
  AdminHealthStatusResponse,
} from './dto/responses/admin-health.response';

@ApiTags('Admin · Health')
@ApiBearerAuth('jwt')
@Controller('admin')
@UseGuards(AppAdminGuard)
@Throttle({ default: { limit: 30, ttl: 60_000 } })
export class AdminHealthController {
  constructor(private readonly service: AdminHealthServiceImpl) {}

  @Get('health/status')
  @ApiOperation({
    summary: 'Instance health summary (admin)',
    description:
      'Returns the high-level health snapshot — uptime percentage, last incident, DB size, warning count, active sessions. Requires `appRole = ADMIN`. Throttled to 30 req/min.',
  })
  @ApiResponse({ status: 200, type: AdminHealthStatusResponse })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  @ApiResponse({ status: 403, description: 'Caller is not an app admin.' })
  status(): Promise<AdminHealthStatus> {
    return this.service.getStatus();
  }

  @Get('health/services')
  @ApiOperation({
    summary: 'External service probes (admin)',
    description:
      'Returns the per-service uptime sparkline (PostgreSQL, mail, OIDC, etc.) for the last 30 buckets. Requires `appRole = ADMIN`.',
  })
  @ApiResponse({ status: 200, type: AdminHealthServicesResponseDto })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  @ApiResponse({ status: 403, description: 'Caller is not an app admin.' })
  services(): Promise<AdminHealthServicesResponse> {
    return this.service.getServices();
  }

  @Get('health/performance')
  @ApiOperation({
    summary: 'Performance metrics (admin)',
    description:
      'Returns CPU, RAM, disk, DB query average, mail queue depth and MCP latency, each as a normalized 0..100 value plus state. Requires `appRole = ADMIN`.',
  })
  @ApiResponse({ status: 200, type: AdminHealthPerformanceResponseDto })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  @ApiResponse({ status: 403, description: 'Caller is not an app admin.' })
  performance(): Promise<AdminHealthPerformanceResponse> {
    return this.service.getPerformance();
  }

  @Get('health/db-queries')
  @ApiOperation({
    summary: 'DB query latency history (admin)',
    description:
      'Returns the in-memory bucketed history of DB query latency (points + peak + avg in ms) for the recent window. Requires `appRole = ADMIN`.',
  })
  @ApiResponse({ status: 200, type: AdminHealthDbQueryHistoryResponseDto })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  @ApiResponse({ status: 403, description: 'Caller is not an app admin.' })
  dbQueries(): AdminHealthDbQueryHistoryResponse {
    return this.service.getDbQueryHistory();
  }

  @Get('health/live-log')
  @ApiOperation({
    summary: 'Recent live log entries (admin)',
    description:
      'Returns the last `limit` entries from the in-memory pino log buffer. Requires `appRole = ADMIN`. Convenient for debugging without shelling into the container.',
  })
  @ApiQuery({ name: 'limit', required: false, description: 'How many entries to return (default 50).', example: 50 })
  @ApiResponse({ status: 200, type: AdminHealthLiveLogResponseDto })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  @ApiResponse({ status: 403, description: 'Caller is not an app admin.' })
  liveLog(
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ): AdminHealthLiveLogResponse {
    return this.service.getLiveLog(limit);
  }

  @Get('jobs')
  @ApiOperation({
    summary: 'Scheduled job status (admin)',
    description:
      'Returns the registered cron jobs with their cron expression, last/next run timestamps and current state. Requires `appRole = ADMIN`.',
  })
  @ApiResponse({ status: 200, type: AdminHealthJobsResponseDto })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  @ApiResponse({ status: 403, description: 'Caller is not an app admin.' })
  jobs(): Promise<AdminHealthJobsResponse> {
    return this.service.getJobs();
  }
}
