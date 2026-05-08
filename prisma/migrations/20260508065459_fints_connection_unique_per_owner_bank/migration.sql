-- FinTS connection: enforce one connection per (ownerId, blz, loginName)
-- (Phase 14a follow-up).
--
-- The setup wizard accidentally allowed creating a fresh connection on
-- every retry — even for the same bank + login. The unique constraint
-- closes the loop. Existing duplicates from earlier wizard runs are
-- pruned in advance: the most recently updated row per group wins; the
-- older siblings (and their dependent FintsSyncRun rows via cascade)
-- get deleted.

-- 1. Drop older duplicates (keep newest per ownerId+blz+loginName)
DELETE FROM "FintsConnection" a
USING "FintsConnection" b
WHERE a."ownerId" = b."ownerId"
  AND a."blz" = b."blz"
  AND a."loginName" = b."loginName"
  AND a."updatedAt" < b."updatedAt";

-- 2. Add the unique index
CREATE UNIQUE INDEX "FintsConnection_ownerId_blz_loginName_key"
  ON "FintsConnection"("ownerId", "blz", "loginName");
