import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AccountsRepository } from './accounts.repository';
import { AccountsService } from './accounts.service';

/**
 * Phase 14a.1 (FinTS Foundation):
 * Minimal Accounts module — exposes the repository + service so other
 * modules (transactions, csv-import, data-transfer) can resolve the
 * default account and create rows. A full controller with CRUD endpoints
 * lands in a later FinTS UI phase.
 */
@Module({
  imports: [PrismaModule],
  providers: [AccountsRepository, AccountsService],
  exports: [AccountsService],
})
export class AccountsModule {}
