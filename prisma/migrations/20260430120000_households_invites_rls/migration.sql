-- Phase 3: Row-Level Security for household-scoped tables
-- The app-layer HouseholdMemberGuard is the primary enforcement mechanism.
-- These policies provide defense-in-depth when app.household_id GUC is set
-- (e.g., by a future Prisma middleware in Phase 14).

-- Enable RLS on all household-scoped tables
ALTER TABLE "Household"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "HouseholdMembership"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InviteCode"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Category"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Project"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RecurringTransaction"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Transaction"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Budget"                ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ApiKey"                ENABLE ROW LEVEL SECURITY;

-- Superuser (prisma connection role) bypasses RLS automatically.
-- These policies apply to the application role when GUC is set.

-- Household: only visible when id matches GUC
CREATE POLICY "household_rls" ON "Household"
  USING (
    "id" = NULLIF(current_setting('app.household_id', true), '')
  );

-- HouseholdMembership: scoped to active household
CREATE POLICY "household_membership_rls" ON "HouseholdMembership"
  USING (
    "householdId" = NULLIF(current_setting('app.household_id', true), '')
  );

-- InviteCode: scoped to active household
CREATE POLICY "invite_code_rls" ON "InviteCode"
  USING (
    "householdId" = NULLIF(current_setting('app.household_id', true), '')
  );

-- Category: scoped to active household
CREATE POLICY "category_rls" ON "Category"
  USING (
    "householdId" = NULLIF(current_setting('app.household_id', true), '')
  );

-- Project: scoped to active household
CREATE POLICY "project_rls" ON "Project"
  USING (
    "householdId" = NULLIF(current_setting('app.household_id', true), '')
  );

-- RecurringTransaction: scoped to active household
CREATE POLICY "recurring_transaction_rls" ON "RecurringTransaction"
  USING (
    "householdId" = NULLIF(current_setting('app.household_id', true), '')
  );

-- Transaction: scoped to active household
CREATE POLICY "transaction_rls" ON "Transaction"
  USING (
    "householdId" = NULLIF(current_setting('app.household_id', true), '')
  );

-- Budget: scoped to active household
CREATE POLICY "budget_rls" ON "Budget"
  USING (
    "householdId" = NULLIF(current_setting('app.household_id', true), '')
  );

-- ApiKey: scoped to active household
CREATE POLICY "api_key_rls" ON "ApiKey"
  USING (
    "householdId" = NULLIF(current_setting('app.household_id', true), '')
  );
