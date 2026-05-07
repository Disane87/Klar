-- BLZ Registry single-row snapshot (Phase 14a.4)
-- Holds the parsed hbci4j blz.properties bank list. Refreshes overwrite
-- the latest row; historical versions are audited via AuditLog rather
-- than retained here.

CREATE TABLE "BlzRegistry" (
    "id" SERIAL NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceCommit" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "recordCount" INTEGER NOT NULL,
    "banks" JSONB NOT NULL,
    "contentHash" TEXT NOT NULL,

    CONSTRAINT "BlzRegistry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BlzRegistry_fetchedAt_idx" ON "BlzRegistry"("fetchedAt");
