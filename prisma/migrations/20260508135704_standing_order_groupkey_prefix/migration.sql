-- groupKey now embeds the transactionKind so a Bank-Dauerauftrag and a
-- SEPA-Folgelastschrift to the same counterparty / amount produce separate
-- records (each with its own chip). Backfill existing FINTS_DERIVED rows so
-- the next detection run upserts them in place rather than orphaning them.
--
-- For MANUAL records the groupKey already starts with "manual:" — those are
-- left alone (transactionKind is NULL on manual records by design).

-- Step 1: ensure pre-existing FinTS-derived rows have a kind set
-- (records created before the transactionKind column existed).
UPDATE "StandingOrder"
   SET "transactionKind" = 'STANDING_ORDER'
 WHERE "source" = 'FINTS_DERIVED'
   AND "transactionKind" IS NULL;

-- Step 2: prefix the groupKey with the lower-cased kind for FinTS-derived rows
-- that don't already carry the prefix (idempotent on re-run).
UPDATE "StandingOrder"
   SET "groupKey" = LOWER("transactionKind"::text) || '|' || "groupKey"
 WHERE "source" = 'FINTS_DERIVED'
   AND "transactionKind" IS NOT NULL
   AND "groupKey" NOT LIKE 'standing_order|%'
   AND "groupKey" NOT LIKE 'direct_debit|%';
