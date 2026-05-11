-- AlterTable: add bookingText column on Transaction.
ALTER TABLE "Transaction" ADD COLUMN "bookingText" TEXT;

-- CreateIndex: filter & group queries on bookingText per household.
CREATE INDEX "Transaction_householdId_bookingText_idx"
    ON "Transaction"("householdId", "bookingText");

-- Backfill: extract bookingText from existing FinTS/CSV descriptions.
-- The FinTS mapper and the Sparkasse CSV parser both stitch the bookingText
-- into the description blob alongside SEPA-prefix lines (EREF+/MREF+/KREF+).
-- We pull the first whole-line that matches our German banking vocabulary —
-- captured verbatim (case-preserved) so the UI's normalizer can title-case it.
-- Rows without a recognisable label stay NULL; future syncs populate them.
WITH vocabulary AS (
    SELECT '(LASTSCHRIFT|FOLGELASTSCHRIFT|ERSTLASTSCHRIFT|EINMALLASTSCHRIFT|RUECKLASTSCHRIFT|RÜCKLASTSCHRIFT|GUTSCHRIFT|UEBERWEISUNG|ÜBERWEISUNG|DAUERAUFTRAG|DAUERAUFTRAGSGUTSCHRIFT|KARTENZAHLUNG|KARTENVERFUEGUNG|KARTENVERFÜGUNG|BARGELDAUSZAHLUNG|BARGELDEINZAHLUNG|GEHALT|LOHN|RENTE|MIETE|GEBUEHR|GEBÜHR|ZINSEN|ABBUCHUNG|ENTGELT|ECHTZEITUEBERWEISUNG|ECHTZEITÜBERWEISUNG|SEPA-LASTSCHRIFT|SEPA-UEBERWEISUNG|SEPA-ÜBERWEISUNG)' AS pattern
)
UPDATE "Transaction" t
   SET "bookingText" = trim((regexp_match(
        t."description",
        '(^|\n)([^\n]*\m' || (SELECT pattern FROM vocabulary) || '\M[^\n]*)',
        'i'
   ))[2])
 WHERE t."source" IN ('fints', 'csv')
   AND t."bookingText" IS NULL
   AND t."description" ~* (SELECT pattern FROM vocabulary);
