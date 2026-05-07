import { Controller, Get, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AppAdminGuard } from '../../common/guards/app-admin.guard';
import {
  AdminHealthServiceImpl,
  type AdminHealthJobsResponse,
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

  @Get('jobs')
  jobs(): Promise<AdminHealthJobsResponse> {
    return this.service.getJobs();
  }
}
