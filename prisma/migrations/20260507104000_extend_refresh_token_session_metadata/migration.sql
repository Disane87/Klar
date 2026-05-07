-- Sessions UI metadata: ipHash + lastActiveAt on RefreshToken.
-- userAgent already exists; only the hashed IP and activity timestamp are new.

-- AlterTable
ALTER TABLE "RefreshToken"
    ADD COLUMN "ipHash" TEXT,
    ADD COLUMN "lastActiveAt" TIMESTAMP(3);
