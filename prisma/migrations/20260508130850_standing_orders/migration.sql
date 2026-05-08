-- CreateEnum
CREATE TYPE "TransactionKind" AS ENUM ('STANDING_ORDER', 'DIRECT_DEBIT', 'TRANSFER', 'CARD', 'FEE', 'OTHER');

-- CreateEnum
CREATE TYPE "StandingOrderSource" AS ENUM ('FINTS_DERIVED', 'MANUAL');

-- CreateEnum
CREATE TYPE "StandingOrderFrequency" AS ENUM ('WEEKLY', 'MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY', 'CUSTOM', 'UNKNOWN');

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "transactionKind" "TransactionKind";

-- CreateTable
CREATE TABLE "StandingOrder" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "source" "StandingOrderSource" NOT NULL,
    "groupKey" TEXT NOT NULL,
    "counterpartyName" TEXT,
    "counterpartyIban" TEXT,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "frequency" "StandingOrderFrequency" NOT NULL,
    "lastSeenAt" DATE,
    "nextExpectedAt" DATE,
    "categoryId" TEXT,
    "note" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "bankFieldsLockedAt" TIMESTAMP(3),
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StandingOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StandingOrder_householdId_isActive_idx" ON "StandingOrder"("householdId", "isActive");

-- CreateIndex
CREATE INDEX "StandingOrder_accountId_idx" ON "StandingOrder"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "StandingOrder_householdId_accountId_groupKey_key" ON "StandingOrder"("householdId", "accountId", "groupKey");

-- CreateIndex
CREATE INDEX "Transaction_householdId_transactionKind_idx" ON "Transaction"("householdId", "transactionKind");

-- AddForeignKey
ALTER TABLE "StandingOrder" ADD CONSTRAINT "StandingOrder_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StandingOrder" ADD CONSTRAINT "StandingOrder_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StandingOrder" ADD CONSTRAINT "StandingOrder_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
