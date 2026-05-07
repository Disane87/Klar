import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ImportPipelineRepository } from './import-pipeline.repository';
import { ImportPipelineService } from './import-pipeline.service';

/**
 * FinTS Foundation (Phase 14a.7-final).
 *
 * Shared booking-detection helpers (duplicate, fixed-cost, recurring
 * suggester, category suggester, counterparty/row hashing) plus the
 * batch-ingest entry point used by the FinTS sync runner.
 *
 * The CSV import keeps using its own repository for the interactive
 * analyse/confirm flow; only the final write happens in either place
 * — both paths share the same dedup hash so a row imported via FinTS
 * blocks the same row arriving via CSV later (and vice versa).
 */
@Module({
  imports: [PrismaModule],
  providers: [ImportPipelineRepository, ImportPipelineService],
  exports: [ImportPipelineService],
})
export class ImportPipelineModule {}
