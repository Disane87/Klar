-- Notification rules engine: foundation models.
-- Predicate AST stored as JSONB; validation lives in @klar/shared notification-rules.
-- Rules are owned per-user (PRIVATE-aware), households are the multi-tenancy boundary.

-- CreateEnum
CREATE TYPE "NotificationTrigger" AS ENUM (
    'TRANSACTION_CREATED',
    'STANDING_ORDER_DUE',
    'BUDGET_THRESHOLD',
    'FINTS_SYNC_EVENT',
    'SCHEDULED'
);

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM (
    'IN_APP',
    'WEB_PUSH',
    'EMAIL'
);

-- CreateEnum
CREATE TYPE "DigestMode" AS ENUM (
    'IMMEDIATE',
    'HOURLY',
    'DAILY'
);

-- CreateTable
CREATE TABLE "NotificationRule" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "trigger" "NotificationTrigger" NOT NULL,
    "predicateJson" JSONB NOT NULL,
    "scheduleJson" JSONB,
    "leadTimeDays" INTEGER,
    "channels" "NotificationChannel"[] DEFAULT ARRAY[]::"NotificationChannel"[],
    "digestMode" "DigestMode" NOT NULL DEFAULT 'IMMEDIATE',
    "cooldownMinutes" INTEGER,
    "maxPerHour" INTEGER,
    "maxPerDay" INTEGER,
    "lastFiredAt" TIMESTAMP(3),
    "firedCountToday" INTEGER NOT NULL DEFAULT 0,
    "firedBucketDate" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NotificationRule_householdId_userId_enabled_idx"
    ON "NotificationRule"("householdId", "userId", "enabled");

-- CreateIndex
CREATE INDEX "NotificationRule_trigger_enabled_idx"
    ON "NotificationRule"("trigger", "enabled");

-- AddForeignKey
ALTER TABLE "NotificationRule"
    ADD CONSTRAINT "NotificationRule_householdId_fkey"
    FOREIGN KEY ("householdId") REFERENCES "Household"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationRule"
    ADD CONSTRAINT "NotificationRule_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "NotificationRuleFire" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "sourceKind" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "firedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "channelsSent" "NotificationChannel"[] DEFAULT ARRAY[]::"NotificationChannel"[],
    "notificationId" TEXT,

    CONSTRAINT "NotificationRuleFire_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NotificationRuleFire_ruleId_sourceKind_sourceId_key"
    ON "NotificationRuleFire"("ruleId", "sourceKind", "sourceId");

-- CreateIndex
CREATE INDEX "NotificationRuleFire_ruleId_firedAt_idx"
    ON "NotificationRuleFire"("ruleId", "firedAt");

-- AddForeignKey
ALTER TABLE "NotificationRuleFire"
    ADD CONSTRAINT "NotificationRuleFire_ruleId_fkey"
    FOREIGN KEY ("ruleId") REFERENCES "NotificationRule"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "WebPushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebPushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WebPushSubscription_endpoint_key"
    ON "WebPushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "WebPushSubscription_userId_idx" ON "WebPushSubscription"("userId");

-- CreateIndex
CREATE INDEX "WebPushSubscription_householdId_idx" ON "WebPushSubscription"("householdId");

-- AddForeignKey
ALTER TABLE "WebPushSubscription"
    ADD CONSTRAINT "WebPushSubscription_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "NotificationDigestQueue" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "ruleId" TEXT NOT NULL,
    "payloadJson" JSONB NOT NULL,
    "bucketKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationDigestQueue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NotificationDigestQueue_userId_channel_bucketKey_idx"
    ON "NotificationDigestQueue"("userId", "channel", "bucketKey");

-- AddForeignKey
ALTER TABLE "NotificationDigestQueue"
    ADD CONSTRAINT "NotificationDigestQueue_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "NotificationUserSettings" (
    "userId" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "quietHoursStart" TEXT,
    "quietHoursEnd" TEXT,
    "quietHoursTz" TEXT,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "webPushEnabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationUserSettings_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "NotificationUserSettings"
    ADD CONSTRAINT "NotificationUserSettings_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
