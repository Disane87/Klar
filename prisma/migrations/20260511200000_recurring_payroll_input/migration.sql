-- AlterTable: store optional GrossToNetInput snapshot for salary recurrings
ALTER TABLE "RecurringTransaction" ADD COLUMN "payrollInput" JSONB;
