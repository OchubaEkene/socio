-- AlterTable
ALTER TABLE "rules" ADD COLUMN     "requiredQualifications" TEXT[] DEFAULT ARRAY[]::TEXT[];
