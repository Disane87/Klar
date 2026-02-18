import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Household } from './household.entity';
import { HouseholdMember } from './household-member.entity';
import { HouseholdsService } from './households.service';
import { HouseholdsController } from './households.controller';
import { IncomesModule } from '../incomes/incomes.module';
import { BudgetsModule } from '../budgets/budgets.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Household, HouseholdMember]),
    IncomesModule,
    BudgetsModule,
  ],
  providers: [HouseholdsService],
  controllers: [HouseholdsController],
  exports: [HouseholdsService],
})
export class HouseholdsModule {}
