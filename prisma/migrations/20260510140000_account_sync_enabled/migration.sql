-- Phase 14a.5: per-account sync toggle.
-- Lets users exclude individual FinTS sub-accounts from the sync loop while
-- keeping their history visible. csv_only/manual accounts ignore the flag.
ALTER TABLE "Account"
  ADD COLUMN "syncEnabled" BOOLEAN NOT NULL DEFAULT true;
