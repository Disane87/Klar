import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { HouseholdsModule } from '../households/households.module';
import { OverviewService } from './overview.service';
import { OverviewController } from './overview.controller';

@Module({
  imports: [PrismaModule, HouseholdsModule],
  providers: [OverviewService],
  controllers: [OverviewController],
  exports: [OverviewService],
})
export class OverviewModule {}
