-- Adds WEEKLY to the FixedCostCycle enum. The unified fixed-cost detector
-- already returns WEEKLY for ~7-day cadences, but the enum was missing the
-- variant — every WEEKLY candidate was being rejected by Prisma at insert
-- time, silently dropped (the call is wrapped in try/catch by the FinTS
-- sync runner).
ALTER TYPE "FixedCostCycle" ADD VALUE 'WEEKLY' BEFORE 'MONTHLY';
