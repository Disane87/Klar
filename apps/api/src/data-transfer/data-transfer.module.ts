// apps/api/src/data-transfer/data-transfer.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { HouseholdsModule } from '../households/households.module';
import { DataTransferRepository } from './data-transfer.repository';
import { DataTransferService } from './data-transfer.service';
import { DataTransferController } from './data-transfer.controller';

@Module({
  imports: [PrismaModule, HouseholdsModule],
  providers: [DataTransferRepository, DataTransferService],
  controllers: [DataTransferController],
})
export class DataTransferModule {}
