-- AlterTable: store optional Gehaltsrechner input snapshot per user
ALTER TABLE "User" ADD COLUMN "payrollCalculatorState" JSONB;
