-- CSV Import: new tables + Transaction extension fields

-- CreateTable
CREATE TABLE "CsvImport" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "rowCount" INTEGER NOT NULL,
    "importedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedDuplicates" INTEGER NOT NULL DEFAULT 0,
    "skippedFixed" INTEGER NOT NULL DEFAULT 0,
    "createdRecurrings" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CsvImport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CsvImport_householdId_createdAt_idx" ON "CsvImport"("householdId", "createdAt");

-- AddForeignKey
ALTER TABLE "CsvImport" ADD CONSTRAINT "CsvImport_householdId_fkey"
    FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "ImportLearning" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "counterpartyKey" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "hitCount" INTEGER NOT NULL DEFAULT 1,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportLearning_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ImportLearning_householdId_counterpartyKey_key" ON "ImportLearning"("householdId", "counterpartyKey");
CREATE INDEX "ImportLearning_householdId_lastUsedAt_idx" ON "ImportLearning"("householdId", "lastUsedAt");

-- AddForeignKey
ALTER TABLE "ImportLearning" ADD CONSTRAINT "ImportLearning_householdId_fkey"
    FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ImportLearning" ADD CONSTRAINT "ImportLearning_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: extend Transaction with external fields
ALTER TABLE "Transaction"
    ADD COLUMN "externalRef" TEXT,
    ADD COLUMN "externalHash" TEXT,
    ADD COLUMN "counterparty" TEXT,
    ADD COLUMN "sourceImportId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_householdId_externalRef_key" ON "Transaction"("householdId", "externalRef");
CREATE INDEX "Transaction_householdId_externalHash_idx" ON "Transaction"("householdId", "externalHash");
CREATE INDEX "Transaction_sourceImportId_idx" ON "Transaction"("sourceImportId");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_sourceImportId_fkey"
    FOREIGN KEY ("sourceImportId") REFERENCES "CsvImport"("id") ON DELETE SET NULL ON UPDATE CASCADE;
