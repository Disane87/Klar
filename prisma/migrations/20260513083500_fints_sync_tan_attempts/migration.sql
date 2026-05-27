-- Adds a TAN-attempt counter per FinTS sync run. Capped in code (see
-- FintsSyncService.MAX_TAN_ATTEMPTS) so a runaway decoupled-poll loop
-- can no longer spam the bank with PIN/TAN messages and trip
-- fraud-detection — losing access to online banking happened once,
-- never again.
ALTER TABLE "FintsSyncRun"
  ADD COLUMN "tanAttempts" INTEGER NOT NULL DEFAULT 0;
