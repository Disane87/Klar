import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { HouseholdsModule } from '../households/households.module';
import { FixedCostsRepository } from './fixed-costs.repository';
import { FixedCostsService } from './fixed-costs.service';
import { FixedCostsController } from './fixed-costs.controller';
import { ContractsRepository } from './contracts.repository';
import { ContractsService } from './contracts.service';

@Module({
  imports: [PrismaModule, HouseholdsModule],
  providers: [
    FixedCostsRepository,
    FixedCostsService,
    ContractsRepository,
    ContractsService,
  ],
  controllers: [FixedCostsController],
  exports: [FixedCostsService, ContractsService],
})
export class FixedCostsModule {}
