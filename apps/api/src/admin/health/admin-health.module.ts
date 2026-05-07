import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AdminHealthController } from './admin-health.controller';
import { AdminHealthServiceImpl } from './admin-health.service';
import { MetricsCollectorService } from './metrics-collector.service';

/**
 * Note: {@link LiveLogBuffer} lives in {@link LiveLogModule} (global) so it
 * can be shared with the pino multistream wired up in `AppModule`. Importing
 * `LiveLogModule` here is unnecessary — `@Global` makes the buffer available
 * in this module's injector automatically.
 */
@Module({
  imports: [PrismaModule],
  controllers: [AdminHealthController],
  providers: [AdminHealthServiceImpl, MetricsCollectorService],
})
export class AdminHealthModule {}
