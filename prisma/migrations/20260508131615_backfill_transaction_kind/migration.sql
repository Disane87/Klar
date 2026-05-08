-- Backfill transactionKind for existing FinTS transactions.
-- Heuristic: rows from FinTS whose stitched description starts with
-- "Dauerauftr" (covers "Dauerauftrag", "Daueraufträge", and bank-specific
-- compounds where the umlaut splits the root). bookingText is appended
-- after EREF/MREF/KREF in the FinTS mapper, so the regex anchors on either
-- start-of-string or a newline. Everything else stays NULL — non-blocking,
-- only used for grouping going forward.
UPDATE "Transaction"
   SET "transactionKind" = 'STANDING_ORDER'
 WHERE "source" = 'fints'
   AND "transactionKind" IS NULL
   AND "description" ~* '(^|\n)Dauerauftr';
