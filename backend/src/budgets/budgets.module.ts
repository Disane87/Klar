import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BudgetEntry } from './budget-entry.entity';
import { BudgetsService } from './budgets.service';
import { BudgetsController } from './budgets.controller';
import { IncomesModule } from '../incomes/incomes.module';

@Module({
  imports: [TypeOrmModule.forFeature([BudgetEntry]), IncomesModule],
  providers: [BudgetsService],
  controllers: [BudgetsController],
  exports: [BudgetsService],
})
export class BudgetsModule {}
