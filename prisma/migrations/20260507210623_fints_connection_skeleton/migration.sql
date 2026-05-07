-- FinTS Connection Skeleton (Phase 14a.3)
-- Adds FintsConnection + FintsSyncRun models, plus the per-Account
-- linkage to FinTS metadata. No data is migrated — connections are
-- created by users via the upcoming setup wizard.

-- 1. New enums
CREATE TYPE "FintsConnectionStatus" AS ENUM ('SETUP', 'ACTIVE', 'TAN_REQUIRED', 'REAUTH_REQUIRED', 'DISABLED', 'ERROR');
CREATE TYPE "FintsSyncStatus" AS ENUM ('RUNNING', 'OK', 'FAILED', 'TAN_REQUIRED', 'REAUTH_REQUIRED', 'CANCELLED');
CREATE TYPE "FintsSyncTrigger" AS ENUM ('CRON', 'MANUAL', 'SETUP');

-- 2. FintsConnection
CREATE TABLE "FintsConnection" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "blz" TEXT NOT NULL,
    "serverUrl" TEXT NOT NULL,
    "loginName" TEXT NOT NULL,
    "credentialsCipher" BYTEA NOT NULL,
    "credentialsIv" BYTEA NOT NULL,
    "credentialsTag" BYTEA NOT NULL,
    "status" "FintsConnectionStatus" NOT NULL DEFAULT 'SETUP',
    "lastScaAt" TIMESTAMP(3),
    "scaExpiresAt" TIMESTAMP(3),
    "lastSyncAt" TIMESTAMP(3),
    "lastSyncStatus" "FintsSyncStatus",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FintsConnection_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FintsConnection_ownerId_idx" ON "FintsConnection"("ownerId");
CREATE INDEX "FintsConnection_householdId_idx" ON "FintsConnection"("householdId");
CREATE INDEX "FintsConnection_scaExpiresAt_idx" ON "FintsConnection"("scaExpiresAt");
CREATE INDEX "FintsConnection_status_idx" ON "FintsConnection"("status");

ALTER TABLE "FintsConnection"
    ADD CONSTRAINT "FintsConnection_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FintsConnection"
    ADD CONSTRAINT "FintsConnection_householdId_fkey"
    FOREIGN KEY ("householdId") REFERENCES "Household"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- 3. FintsSyncRun
CREATE TABLE "FintsSyncRun" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "status" "FintsSyncStatus" NOT NULL,
    "triggeredBy" "FintsSyncTrigger" NOT NULL,
    "triggeredById" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "fromDate" TIMESTAMP(3),
    "toDate" TIMESTAMP(3),
    "bookingsFetched" INTEGER NOT NULL DEFAULT 0,
    "bookingsImported" INTEGER NOT NULL DEFAULT 0,
    "bookingsSkipped" INTEGER NOT NULL DEFAULT 0,
    "balanceDriftCents" INTEGER,
    "tanChallenge" JSONB,
    "errorCode" TEXT,
    "errorMessage" TEXT,

    CONSTRAINT "FintsSyncRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FintsSyncRun_connectionId_startedAt_idx" ON "FintsSyncRun"("connectionId", "startedAt");
CREATE INDEX "FintsSyncRun_status_idx" ON "FintsSyncRun"("status");

ALTER TABLE "FintsSyncRun"
    ADD CONSTRAINT "FintsSyncRun_connectionId_fkey"
    FOREIGN KEY ("connectionId") REFERENCES "FintsConnection"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- 4. Account: FinTS-Connection link + balance fields
ALTER TABLE "Account"
    ADD COLUMN "fintsConnectionId" TEXT,
    ADD COLUMN "fintsAccountRef" TEXT,
    ADD COLUMN "lastKnownBalanceCents" INTEGER,
    ADD COLUMN "lastBalanceAt" TIMESTAMP(3);

CREATE INDEX "Account_fintsConnectionId_idx" ON "Account"("fintsConnectionId");

ALTER TABLE "Account"
    ADD CONSTRAINT "Account_fintsConnectionId_fkey"
    FOREIGN KEY ("fintsConnectionId") REFERENCES "FintsConnection"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
