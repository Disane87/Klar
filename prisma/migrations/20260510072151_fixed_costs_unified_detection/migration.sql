-- Unify Contract → FixedCost (base) + Contract (1:1 extension) and add
-- HALF_YEARLY cycle. The detection pipeline now feeds both CSV and FinTS into
-- the same FixedCost table; the Contract extension is opt-in metadata for
-- things the user wants to track as a real contract.
--
-- Migration steps (in order):
--   1. Rename ContractCycle → FixedCostCycle, add HALF_YEARLY value
--   2. Rename ContractStatus → FixedCostStatus
--   3. Add FixedCostSource enum
--   4. Rename Contract table → FixedCost
--   5. Add new `source` column to FixedCost
--   6. Stash existing cancelByAt values, then drop the column
--   7. Create new Contract table (1:1 extension with FK to FixedCost)
--   8. Backfill: for every existing FixedCost that had a cancelByAt OR was in
--      CONFIRMED/DETECTED status (i.e. user already curated it as a contract),
--      create a Contract extension row preserving cancelByAt.

-- 1. Rename ContractCycle → FixedCostCycle and add HALF_YEARLY
ALTER TYPE "ContractCycle" RENAME TO "FixedCostCycle";
ALTER TYPE "FixedCostCycle" ADD VALUE 'HALF_YEARLY' BEFORE 'YEARLY';

-- 2. Rename ContractStatus → FixedCostStatus
ALTER TYPE "ContractStatus" RENAME TO "FixedCostStatus";

-- 3. Create FixedCostSource enum
CREATE TYPE "FixedCostSource" AS ENUM ('AUTO_DETECTED', 'USER_DEFINED');

-- 4. Stash old contract IDs + cancelByAt before destructive changes.
-- We need this to backfill the new Contract extension table after the rename.
CREATE TEMP TABLE _contract_backfill AS
  SELECT id AS "fixedCostId", "cancelByAt", "status"
  FROM "Contract";

-- 5. Drop the old FK so we can rename the table
ALTER TABLE "Contract" DROP CONSTRAINT "Contract_householdId_fkey";

-- 6. Rename Contract → FixedCost and rename indexes/PK
ALTER TABLE "Contract" RENAME TO "FixedCost";
ALTER INDEX "Contract_pkey" RENAME TO "FixedCost_pkey";
ALTER INDEX "Contract_householdId_status_idx" RENAME TO "FixedCost_householdId_status_idx";
ALTER INDEX "Contract_householdId_nextRenewalAt_idx" RENAME TO "FixedCost_householdId_nextRenewalAt_idx";

-- 7. Re-add the FK with the new name
ALTER TABLE "FixedCost"
  ADD CONSTRAINT "FixedCost_householdId_fkey"
  FOREIGN KEY ("householdId")
  REFERENCES "Household"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

-- 8. Add the source column. All pre-existing rows are auto-detected.
ALTER TABLE "FixedCost"
  ADD COLUMN "source" "FixedCostSource" NOT NULL DEFAULT 'AUTO_DETECTED';

-- 9. Create the new source index
CREATE INDEX "FixedCost_householdId_source_idx" ON "FixedCost"("householdId", "source");

-- 10. Drop the cancelByAt column from FixedCost (now lives on Contract extension)
ALTER TABLE "FixedCost" DROP COLUMN "cancelByAt";

-- 11. Create the new Contract extension table
CREATE TABLE "Contract" (
    "id" TEXT NOT NULL,
    "fixedCostId" TEXT NOT NULL,
    "cancelByAt" DATE,
    "contractStartedAt" DATE,
    "contractHolder" TEXT,
    "contractNumber" TEXT,
    "providerName" TEXT,
    "documentUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Contract_fixedCostId_key" ON "Contract"("fixedCostId");
CREATE INDEX "Contract_cancelByAt_idx" ON "Contract"("cancelByAt");

ALTER TABLE "Contract"
  ADD CONSTRAINT "Contract_fixedCostId_fkey"
  FOREIGN KEY ("fixedCostId")
  REFERENCES "FixedCost"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

-- 12. Backfill: every old Contract row that had a cancelByAt OR was already
-- curated by the user (CONFIRMED/DETECTED) gets promoted to a Contract
-- extension. CANDIDATE rows without cancelByAt stay as plain FixedCost.
-- We use a CUID-shaped id (lowercase 'c' + 24 hex chars) to stay consistent
-- with Prisma's default. The runtime cuid() generator uses base32 not hex,
-- but at the DB level any unique string is valid.
INSERT INTO "Contract" ("id", "fixedCostId", "cancelByAt", "createdAt", "updatedAt")
SELECT
  'c' || REPLACE(gen_random_uuid()::text, '-', ''),
  "fixedCostId",
  "cancelByAt",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM _contract_backfill
WHERE "cancelByAt" IS NOT NULL
   OR "status" IN ('CONFIRMED', 'DETECTED');

DROP TABLE _contract_backfill;
