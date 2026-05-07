import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { HouseholdsModule } from '../households/households.module';
import { AccountsModule } from '../accounts/accounts.module';
import { CsvImportController } from './csv-import.controller';
import { CsvImportService } from './csv-import.service';
import { CsvImportRepository } from './csv-import.repository';
import { SparkasseCamtV2Parser } from './parsers/sparkasse-camt-v2.parser';

@Module({
  imports: [PrismaModule, HouseholdsModule, AccountsModule],
  providers: [CsvImportService, CsvImportRepository, SparkasseCamtV2Parser],
  controllers: [CsvImportController],
})
export class CsvImportModule {}
