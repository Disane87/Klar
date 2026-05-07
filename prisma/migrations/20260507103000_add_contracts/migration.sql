-- Contracts: detected & confirmed subscription/contract entries per household.

-- CreateEnum
CREATE TYPE "ContractCycle" AS ENUM ('MONTHLY', 'QUARTERLY', 'YEARLY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('CANDIDATE', 'DETECTED', 'CONFIRMED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Contract" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "merchant" TEXT,
    "categoryId" TEXT,
    "amountCents" INTEGER NOT NULL,
    "cycle" "ContractCycle" NOT NULL,
    "nextRenewalAt" DATE,
    "cancelByAt" DATE,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "ContractStatus" NOT NULL DEFAULT 'CANDIDATE',
    "detectedFromTransactionIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Contract_householdId_status_idx" ON "Contract"("householdId", "status");

-- CreateIndex
CREATE INDEX "Contract_householdId_nextRenewalAt_idx" ON "Contract"("householdId", "nextRenewalAt");

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;
