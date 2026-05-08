import { Module } from '@nestjs/common';
import { HouseholdsModule } from '../households/households.module';
import { StandingOrdersController } from './standing-orders.controller';
import { StandingOrdersDetection } from './standing-orders.detection';
import { StandingOrdersRepository } from './standing-orders.repository';
import { StandingOrdersService } from './standing-orders.service';

// PrismaModule is @Global() — no need to re-import it here.
// HouseholdsModule provides HouseholdsRepository, required by HouseholdMemberGuard
// which the controller activates via @UseGuards.
@Module({
  imports: [HouseholdsModule],
  controllers: [StandingOrdersController],
  providers: [StandingOrdersService, StandingOrdersDetection, StandingOrdersRepository],
  exports: [StandingOrdersDetection, StandingOrdersRepository],
})
export class StandingOrdersModule {}
