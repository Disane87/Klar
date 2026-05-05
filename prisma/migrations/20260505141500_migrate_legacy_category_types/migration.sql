-- Migrate legacy CategoryType values to the new symmetric model.
--
-- INCOME  -> VARIABLE_INCOME   (FIXED_INCOME is already used for salaries)
-- EXPENSE -> FIXED_EXPENSE     (most existing expenses in households are
--                              recurring/contractual; users can re-categorize
--                              ad-hoc spending to VARIABLE_EXPENSE manually)
--
-- This must run in a separate migration from the enum extension because
-- Postgres does not allow using a newly added enum value within the same
-- transaction that added it.

UPDATE "Category" SET type = 'VARIABLE_INCOME' WHERE type = 'INCOME';
UPDATE "Category" SET type = 'FIXED_EXPENSE'   WHERE type = 'EXPENSE';
