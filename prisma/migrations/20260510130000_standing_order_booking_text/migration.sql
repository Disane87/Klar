-- AlterTable: add bookingText column on StandingOrder.
ALTER TABLE "StandingOrder" ADD COLUMN "bookingText" TEXT;

-- CreateIndex: filter & group queries on bookingText per household.
CREATE INDEX "StandingOrder_householdId_bookingText_idx"
    ON "StandingOrder"("householdId", "bookingText");

-- Backfill: copy bookingText from the most-recent transaction whose detection
-- group key matches the StandingOrder (kind|lowercased name|amountCents).
-- Mirrors makeGroupKey() in standing-orders.detection.ts. Only FINTS_DERIVED
-- rows get backfilled — MANUAL records have no underlying transactions.
WITH latest_tx AS (
    SELECT DISTINCT ON (
        t."householdId",
        t."accountId",
        LOWER(t."transactionKind"::text),
        LOWER(REGEXP_REPLACE(COALESCE(t."counterparty", ''), '\s+', ' ', 'g')),
        t."amountCents"
    )
        t."householdId",
        t."accountId",
        LOWER(t."transactionKind"::text)
            || '|' || TRIM(LOWER(REGEXP_REPLACE(COALESCE(t."counterparty", ''), '\s+', ' ', 'g')))
            || '|' || t."amountCents"::text       AS group_key,
        t."bookingText"
    FROM "Transaction" t
    WHERE t."transactionKind" IN ('STANDING_ORDER', 'DIRECT_DEBIT')
      AND t."bookingText" IS NOT NULL
    ORDER BY
        t."householdId",
        t."accountId",
        LOWER(t."transactionKind"::text),
        LOWER(REGEXP_REPLACE(COALESCE(t."counterparty", ''), '\s+', ' ', 'g')),
        t."amountCents",
        t."date" DESC
)
UPDATE "StandingOrder" s
   SET "bookingText" = lt."bookingText"
  FROM latest_tx lt
 WHERE s."source" = 'FINTS_DERIVED'
   AND s."bookingText" IS NULL
   AND s."householdId" = lt."householdId"
   AND s."accountId"   = lt."accountId"
   AND s."groupKey"    = lt.group_key;
