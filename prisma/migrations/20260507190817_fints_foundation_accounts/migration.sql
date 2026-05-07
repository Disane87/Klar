-- FinTS Foundation (Phase 14a.1)
-- Introduce Account entity, link Transactions to Accounts, classify source.
-- Backfill: every household receives a default csv_only "Hauptkonto"; all
-- existing transactions are linked to it. After backfill, accountId is
-- tightened to NOT NULL.

-- 1. New enums
CREATE TYPE "AccountType" AS ENUM ('fints', 'csv_only', 'cash', 'manual');
CREATE TYPE "TxSource" AS ENUM ('manual', 'csv', 'fints');

-- 2. Account table
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "ownerId" TEXT,
    "name" TEXT NOT NULL,
    "type" "AccountType" NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "iban" TEXT,
    "bic" TEXT,
    "visibility" "Visibility" NOT NULL DEFAULT 'SHARED',
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Account_householdId_idx" ON "Account"("householdId");
CREATE INDEX "Account_householdId_type_idx" ON "Account"("householdId", "type");
CREATE INDEX "Account_ownerId_idx" ON "Account"("ownerId");

ALTER TABLE "Account"
    ADD CONSTRAINT "Account_householdId_fkey"
    FOREIGN KEY ("householdId") REFERENCES "Household"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Account"
    ADD CONSTRAINT "Account_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- 3. Transaction extensions (nullable while backfilling)
ALTER TABLE "Transaction"
    ADD COLUMN "accountId" TEXT,
    ADD COLUMN "source" "TxSource" NOT NULL DEFAULT 'manual',
    ADD COLUMN "bankFieldsLockedAt" TIMESTAMP(3);

-- 4. Backfill: one default Account per Household, all transactions linked
WITH new_accounts AS (
    INSERT INTO "Account" ("id", "householdId", "name", "type", "currency", "visibility", "createdAt", "updatedAt")
    SELECT
        -- cuid-like fallback id; Prisma never validates the format on read.
        -- Format chosen so it's clearly machine-generated: 'acc_' + household id (truncated).
        'acc_' || substr(md5(random()::text || h."id"), 1, 24),
        h."id",
        'Hauptkonto',
        'csv_only'::"AccountType",
        'EUR',
        'SHARED'::"Visibility",
        NOW(),
        NOW()
    FROM "Household" h
    RETURNING "id", "householdId"
)
UPDATE "Transaction" t
SET "accountId" = na."id"
FROM new_accounts na
WHERE t."householdId" = na."householdId";

-- 5. Backfill source: existing transactions with sourceImportId came from CSV; rest are manual
UPDATE "Transaction"
SET "source" = 'csv'::"TxSource"
WHERE "sourceImportId" IS NOT NULL;

-- 6. Tighten accountId NOT NULL after backfill
ALTER TABLE "Transaction" ALTER COLUMN "accountId" SET NOT NULL;

-- 7. FK + indexes for Transaction.accountId
ALTER TABLE "Transaction"
    ADD CONSTRAINT "Transaction_accountId_fkey"
    FOREIGN KEY ("accountId") REFERENCES "Account"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "Transaction_accountId_idx" ON "Transaction"("accountId");
CREATE INDEX "Transaction_accountId_source_idx" ON "Transaction"("accountId", "source");
