-- CreateTable
CREATE TABLE "schedule_plans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "weekEnd" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "totalShifts" INTEGER NOT NULL DEFAULT 0,
    "emailsSent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schedule_plans_pkey" PRIMARY KEY ("id")
);
