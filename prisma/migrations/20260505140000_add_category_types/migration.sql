-- Extend CategoryType with symmetric income/expense types and SAVINGS.
-- Existing INCOME and EXPENSE values are preserved as legacy fallbacks;
-- migrating them to the new types is left to the application/user.

ALTER TYPE "CategoryType" ADD VALUE IF NOT EXISTS 'VARIABLE_INCOME';
ALTER TYPE "CategoryType" ADD VALUE IF NOT EXISTS 'FIXED_EXPENSE';
ALTER TYPE "CategoryType" ADD VALUE IF NOT EXISTS 'VARIABLE_EXPENSE';
ALTER TYPE "CategoryType" ADD VALUE IF NOT EXISTS 'SAVINGS';
