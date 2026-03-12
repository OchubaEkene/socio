-- CreateEnum
CREATE TYPE "AbsenceType" AS ENUM ('SICK_LEAVE', 'PERSONAL_LEAVE', 'EMERGENCY', 'OTHER');

-- CreateEnum
CREATE TYPE "AbsenceStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "VacationType" AS ENUM ('ANNUAL', 'SICK', 'PERSONAL', 'MATERNITY', 'PATERNITY', 'BEREAVEMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "SwapStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "absences" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "absenceType" "AbsenceType" NOT NULL,
    "status" "AbsenceStatus" NOT NULL DEFAULT 'PENDING',
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "reason" TEXT NOT NULL,
    "notes" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "absences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vacation_requests" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "vacationType" "VacationType" NOT NULL,
    "status" "AbsenceStatus" NOT NULL DEFAULT 'PENDING',
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "totalDays" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "notes" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vacation_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vacation_policies" (
    "id" TEXT NOT NULL,
    "staffType" "StaffType" NOT NULL,
    "vacationType" "VacationType" NOT NULL,
    "annualAllowance" INTEGER NOT NULL,
    "carryOverLimit" INTEGER NOT NULL DEFAULT 0,
    "minNoticeDays" INTEGER NOT NULL DEFAULT 14,
    "maxConsecutiveDays" INTEGER NOT NULL DEFAULT 30,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vacation_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift_swaps" (
    "id" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "responderId" TEXT NOT NULL,
    "requesterShiftId" TEXT NOT NULL,
    "responderShiftId" TEXT NOT NULL,
    "status" "SwapStatus" NOT NULL DEFAULT 'PENDING',
    "requesterReason" TEXT,
    "responderReason" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shift_swaps_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "absences" ADD CONSTRAINT "absences_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "absences" ADD CONSTRAINT "absences_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vacation_requests" ADD CONSTRAINT "vacation_requests_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vacation_requests" ADD CONSTRAINT "vacation_requests_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_swaps" ADD CONSTRAINT "shift_swaps_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_swaps" ADD CONSTRAINT "shift_swaps_responderId_fkey" FOREIGN KEY ("responderId") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_swaps" ADD CONSTRAINT "shift_swaps_requesterShiftId_fkey" FOREIGN KEY ("requesterShiftId") REFERENCES "shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_swaps" ADD CONSTRAINT "shift_swaps_responderShiftId_fkey" FOREIGN KEY ("responderShiftId") REFERENCES "shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_swaps" ADD CONSTRAINT "shift_swaps_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
