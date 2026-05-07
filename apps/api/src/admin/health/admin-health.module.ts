import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AdminHealthController } from './admin-health.controller';
import { AdminHealthServiceImpl } from './admin-health.service';
import { LiveLogBuffer } from './live-log.buffer';
import { MetricsCollectorService } from './metrics-collector.service';

@Module({
  imports: [PrismaModule],
  controllers: [AdminHealthController],
  providers: [AdminHealthServiceImpl, MetricsCollectorService, LiveLogBuffer],
  exports: [LiveLogBuffer],
})
export class AdminHealthModule {}
