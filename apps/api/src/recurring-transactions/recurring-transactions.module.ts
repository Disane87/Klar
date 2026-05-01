import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { HouseholdsModule } from '../households/households.module';
import { RecurringTransactionsRepository } from './recurring-transactions.repository';
import { RecurringTransactionsService } from './recurring-transactions.service';
import { RecurringTransactionsController } from './recurring-transactions.controller';

@Module({
  imports: [PrismaModule, HouseholdsModule],
  providers: [RecurringTransactionsRepository, RecurringTransactionsService],
  controllers: [RecurringTransactionsController],
  exports: [RecurringTransactionsService],
})
export class RecurringTransactionsModule {}
