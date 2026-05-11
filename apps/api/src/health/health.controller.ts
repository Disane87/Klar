import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { HealthResponse as HealthResponseDto } from './dto/responses/health.response';

export interface HealthResponse {
  status: 'ok' | 'error';
  timestamp: string;
  version: string;
}

@ApiTags('Health')
@Controller('health')
export class HealthController {
  @Public()
  @Get()
  @ApiOperation({
    summary: 'Liveness probe',
    description:
      'Returns 200 with status, timestamp and version if the API process is responding. Used by the Docker healthcheck and Traefik. Public endpoint — no authentication required.',
  })
  @ApiResponse({ status: 200, type: HealthResponseDto })
  check(): HealthResponse {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: process.env['APP_VERSION'] ?? 'dev',
    };
  }
}
