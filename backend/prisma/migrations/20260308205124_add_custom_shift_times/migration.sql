-- AlterTable
ALTER TABLE "rules" ADD COLUMN     "endHour" INTEGER NOT NULL DEFAULT 20,
ADD COLUMN     "shiftName" TEXT,
ADD COLUMN     "startHour" INTEGER NOT NULL DEFAULT 8;

-- AlterTable
ALTER TABLE "shifts" ADD COLUMN     "shiftName" TEXT;
