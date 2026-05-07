-- CreateTable
CREATE TABLE "RecurringTransactionSplit" (
    "id" TEXT NOT NULL,
    "recurringTransactionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "categoryId" TEXT,
    "note" TEXT,

    CONSTRAINT "RecurringTransactionSplit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecurringTransactionSplit_recurringTransactionId_idx" ON "RecurringTransactionSplit"("recurringTransactionId");

-- AddForeignKey
ALTER TABLE "RecurringTransactionSplit" ADD CONSTRAINT "RecurringTransactionSplit_recurringTransactionId_fkey" FOREIGN KEY ("recurringTransactionId") REFERENCES "RecurringTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringTransactionSplit" ADD CONSTRAINT "RecurringTransactionSplit_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
