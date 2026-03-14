-- AlterTable
ALTER TABLE "absences" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "org_settings" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "rules" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "schedule_plans" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "scheduling_exceptions" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "shift_swaps" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "shifts" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "staff" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "time_records" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "vacation_policies" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "vacation_requests" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "working_time_accounts" ADD COLUMN     "organizationId" TEXT;

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- Create a default organization for existing data
INSERT INTO "organizations" ("id", "name", "createdAt", "updatedAt")
VALUES ('default-org', 'Default Organisation', NOW(), NOW());

-- Backfill existing data to default organization
UPDATE "users" SET "organizationId" = 'default-org' WHERE "organizationId" IS NULL;
UPDATE "staff" SET "organizationId" = 'default-org' WHERE "organizationId" IS NULL;
UPDATE "rules" SET "organizationId" = 'default-org' WHERE "organizationId" IS NULL;
UPDATE "shifts" SET "organizationId" = 'default-org' WHERE "organizationId" IS NULL;
UPDATE "scheduling_exceptions" SET "organizationId" = 'default-org' WHERE "organizationId" IS NULL;
UPDATE "absences" SET "organizationId" = 'default-org' WHERE "organizationId" IS NULL;
UPDATE "vacation_requests" SET "organizationId" = 'default-org' WHERE "organizationId" IS NULL;
UPDATE "vacation_policies" SET "organizationId" = 'default-org' WHERE "organizationId" IS NULL;
UPDATE "shift_swaps" SET "organizationId" = 'default-org' WHERE "organizationId" IS NULL;
UPDATE "working_time_accounts" SET "organizationId" = 'default-org' WHERE "organizationId" IS NULL;
UPDATE "time_records" SET "organizationId" = 'default-org' WHERE "organizationId" IS NULL;
UPDATE "schedule_plans" SET "organizationId" = 'default-org' WHERE "organizationId" IS NULL;
-- Update org_settings singleton to use default org id
UPDATE "org_settings" SET "id" = 'default-org' WHERE "id" = 'singleton';

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff" ADD CONSTRAINT "staff_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rules" ADD CONSTRAINT "rules_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduling_exceptions" ADD CONSTRAINT "scheduling_exceptions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "absences" ADD CONSTRAINT "absences_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vacation_requests" ADD CONSTRAINT "vacation_requests_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vacation_policies" ADD CONSTRAINT "vacation_policies_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_swaps" ADD CONSTRAINT "shift_swaps_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "working_time_accounts" ADD CONSTRAINT "working_time_accounts_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_records" ADD CONSTRAINT "time_records_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_plans" ADD CONSTRAINT "schedule_plans_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_settings" ADD CONSTRAINT "org_settings_id_fkey" FOREIGN KEY ("id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
