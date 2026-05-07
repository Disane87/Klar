-- Notifications: per-household, optionally per-user. Drives Bell + Notification-Center.

-- CreateEnum
CREATE TYPE "NotificationKind" AS ENUM (
    'CONTRACT_RENEWAL',
    'CONTRACT_PRICE_CHANGE',
    'RECURRING_DUE',
    'IMPORT_READY',
    'BUDGET_THRESHOLD',
    'MEMBER_INVITE',
    'SYSTEM'
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "userId" TEXT,
    "kind" "NotificationKind" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "payloadJson" JSONB,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notification_householdId_userId_readAt_idx" ON "Notification"("householdId", "userId", "readAt");

-- CreateIndex
CREATE INDEX "Notification_householdId_createdAt_idx" ON "Notification"("householdId", "createdAt");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
