/*
  Warnings:

  - You are about to drop the column `requiredQualifications` on the `rules` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'manager', 'staff');

-- AlterTable
ALTER TABLE "rules" DROP COLUMN "requiredQualifications";

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'staff';
