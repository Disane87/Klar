-- Add planned/realized state to transactions, with archive of original planned amount
ALTER TABLE "Transaction"
  ADD COLUMN "isPlanned" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "plannedAmountCents" INTEGER;

CREATE INDEX "Transaction_householdId_isPlanned_idx" ON "Transaction"("householdId", "isPlanned");
