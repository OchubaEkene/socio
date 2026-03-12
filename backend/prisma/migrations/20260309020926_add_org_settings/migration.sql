-- CreateTable
CREATE TABLE "org_settings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "orgName" TEXT NOT NULL DEFAULT 'My Organisation',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "dayShiftStart" INTEGER NOT NULL DEFAULT 8,
    "dayShiftEnd" INTEGER NOT NULL DEFAULT 20,
    "nightShiftStart" INTEGER NOT NULL DEFAULT 20,
    "nightShiftEnd" INTEGER NOT NULL DEFAULT 8,
    "defaultDayStaff" INTEGER NOT NULL DEFAULT 2,
    "defaultNightStaff" INTEGER NOT NULL DEFAULT 2,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "org_settings_pkey" PRIMARY KEY ("id")
);
