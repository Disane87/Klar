import { Controller, DefaultValuePipe, Get, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
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

@Controller('admin')
@UseGuards(AppAdminGuard)
@Throttle({ default: { limit: 30, ttl: 60_000 } })
export class AdminHealthController {
  constructor(private readonly service: AdminHealthServiceImpl) {}

  @Get('health/status')
  status(): Promise<AdminHealthStatus> {
    return this.service.getStatus();
  }

  @Get('health/services')
  services(): Promise<AdminHealthServicesResponse> {
    return this.service.getServices();
  }

  @Get('health/performance')
  performance(): Promise<AdminHealthPerformanceResponse> {
    return this.service.getPerformance();
  }

  @Get('health/db-queries')
  dbQueries(): AdminHealthDbQueryHistoryResponse {
    return this.service.getDbQueryHistory();
  }

  @Get('health/live-log')
  liveLog(
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ): AdminHealthLiveLogResponse {
    return this.service.getLiveLog(limit);
  }

  @Get('jobs')
  jobs(): Promise<AdminHealthJobsResponse> {
    return this.service.getJobs();
  }
}
