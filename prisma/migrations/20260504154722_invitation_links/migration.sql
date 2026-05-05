/*
  Warnings:

  - You are about to drop the `InviteCode` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "InviteCode" DROP CONSTRAINT "InviteCode_householdId_fkey";

-- DropTable
DROP TABLE "InviteCode";

-- CreateTable
CREATE TABLE "InvitationLink" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "email" TEXT,
    "createdByUserId" TEXT,
    "expiresAt" TIMESTAMP(3),
    "usedAt" TIMESTAMP(3),
    "usedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvitationLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InvitationLink_token_key" ON "InvitationLink"("token");

-- CreateIndex
CREATE INDEX "InvitationLink_householdId_idx" ON "InvitationLink"("householdId");

-- CreateIndex
CREATE INDEX "InvitationLink_token_idx" ON "InvitationLink"("token");

-- AddForeignKey
ALTER TABLE "InvitationLink" ADD CONSTRAINT "InvitationLink_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS: InvitationLink (household-scoped, same pattern as other tables)
ALTER TABLE "InvitationLink" ENABLE ROW LEVEL SECURITY;
CREATE POLICY invitation_link_isolation ON "InvitationLink"
  USING (
    "householdId" = current_setting('app.household_id', TRUE)
    OR current_setting('app.household_id', TRUE) IS NULL
    OR current_setting('app.household_id', TRUE) = ''
  );
