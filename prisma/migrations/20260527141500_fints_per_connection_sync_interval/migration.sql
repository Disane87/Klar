-- Phase 8 — per-connection FinTS sync interval.
-- Replaces the global FINTS_SYNC_INTERVAL_MINUTES cron with a per-row
-- syncInterval + nextSyncAt the master tick scheduler reads.
-- Backfill: every existing connection → H24, nextSyncAt = now + 24h.

-- CreateEnum
CREATE TYPE "FintsSyncInterval" AS ENUM (
    'MANUAL',
    'H4',
    'H6',
    'H12',
    'H24',
    'H48',
    'H168'
);

-- AlterTable
ALTER TABLE "FintsConnection"
    ADD COLUMN "syncInterval" "FintsSyncInterval" NOT NULL DEFAULT 'H24',
    ADD COLUMN "syncEnabled"  BOOLEAN            NOT NULL DEFAULT true,
    ADD COLUMN "nextSyncAt"   TIMESTAMP(3);

-- Backfill nextSyncAt for existing rows so the master tick starts honouring
-- them from "now + 24h" rather than firing immediately for every connection.
UPDATE "FintsConnection"
   SET "nextSyncAt" = NOW() + INTERVAL '24 hours'
 WHERE "nextSyncAt" IS NULL;
