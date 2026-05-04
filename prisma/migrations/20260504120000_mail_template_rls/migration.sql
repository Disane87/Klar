-- Add RLS for HouseholdMailTemplate table
ALTER TABLE "HouseholdMailTemplate" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "household_mail_template_rls" ON "HouseholdMailTemplate"
  USING (
    "householdId" = NULLIF(current_setting('app.household_id', true), '')
  );