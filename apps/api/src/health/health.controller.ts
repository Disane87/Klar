import { Controller, Get } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';

export interface HealthResponse {
  status: 'ok' | 'error';
  timestamp: string;
  version: string;
}

@Controller('health')
export class HealthController {
  @Public()
  @Get()
  check(): HealthResponse {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: process.env['APP_VERSION'] ?? 'dev',
    };
  }
}
