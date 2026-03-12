-- AlterTable
ALTER TABLE "shifts" ADD COLUMN     "ruleId" TEXT;

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;
