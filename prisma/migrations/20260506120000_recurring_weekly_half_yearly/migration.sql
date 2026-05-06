-- Extend RecurringFrequency with WEEKLY and HALF_YEARLY.

ALTER TYPE "RecurringFrequency" ADD VALUE IF NOT EXISTS 'WEEKLY';
ALTER TYPE "RecurringFrequency" ADD VALUE IF NOT EXISTS 'HALF_YEARLY';
