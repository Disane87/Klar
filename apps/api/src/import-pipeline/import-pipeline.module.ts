import { Module } from '@nestjs/common';

/**
 * FinTS Foundation (Phase 14a.2):
 * Shared booking-detection helpers (duplicate detection, fixed-cost matching,
 * recurring/category suggestions, counterparty/row hashing) used by the
 * existing CSV import and the upcoming FinTS sync runner.
 *
 * The classes are pure (no Nest DI) and re-exported from the module's
 * top-level index files. The FinTS module imports them directly when it
 * lands in phase 14a.3+; csv-import already does.
 *
 * The full pipeline orchestration service (single ingest() entry that
 * dedupes + persists Transactions) lives behind this module too once the
 * FinTS sync runner needs it. For now this module is a structural marker
 * with no providers, so it doesn't affect the application module graph.
 */
@Module({})
export class ImportPipelineModule {}
