-- Transaction → FintsSyncRun link (Phase 14a.7-final)
-- Adds the FK so the import pipeline can record which sync run created
-- a given Transaction, mirroring the existing sourceImportId/CsvImport
-- linkage. Nullable because manual + CSV imports do not have one.

ALTER TABLE "Transaction" ADD COLUMN "fintsSyncRunId" TEXT;

CREATE INDEX "Transaction_fintsSyncRunId_idx" ON "Transaction"("fintsSyncRunId");

ALTER TABLE "Transaction"
    ADD CONSTRAINT "Transaction_fintsSyncRunId_fkey"
    FOREIGN KEY ("fintsSyncRunId") REFERENCES "FintsSyncRun"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
