-- AlterTable
ALTER TABLE "schedule_plans" ADD COLUMN     "exceptionsData" JSONB NOT NULL DEFAULT '[]';
