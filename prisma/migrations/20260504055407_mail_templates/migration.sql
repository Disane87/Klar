-- CreateEnum
CREATE TYPE "MailTemplateType" AS ENUM ('INVITE', 'REMINDER', 'CUSTOM');

-- CreateTable
CREATE TABLE "HouseholdMailTemplate" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "templateType" "MailTemplateType" NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HouseholdMailTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HouseholdMailTemplate_householdId_idx" ON "HouseholdMailTemplate"("householdId");

-- CreateIndex
CREATE UNIQUE INDEX "HouseholdMailTemplate_householdId_templateType_key" ON "HouseholdMailTemplate"("householdId", "templateType");

-- AddForeignKey
ALTER TABLE "HouseholdMailTemplate" ADD CONSTRAINT "HouseholdMailTemplate_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;
