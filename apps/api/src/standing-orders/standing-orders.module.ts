import { Module } from '@nestjs/common';
import { StandingOrdersDetection } from './standing-orders.detection';
import { StandingOrdersRepository } from './standing-orders.repository';

// PrismaModule is @Global() — no need to re-import it here.
@Module({
  providers: [StandingOrdersDetection, StandingOrdersRepository],
  exports: [StandingOrdersDetection, StandingOrdersRepository],
})
export class StandingOrdersModule {}
