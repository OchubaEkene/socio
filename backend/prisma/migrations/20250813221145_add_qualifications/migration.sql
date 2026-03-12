-- AlterTable
ALTER TABLE "rules" ADD COLUMN     "requiredQualifications" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "staff" ADD COLUMN     "qualifications" TEXT[] DEFAULT ARRAY[]::TEXT[];
