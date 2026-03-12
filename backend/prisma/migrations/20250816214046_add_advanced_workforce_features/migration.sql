/*
  Warnings:

  - You are about to drop the column `role` on the `users` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "TimeAccountType" AS ENUM ('OVERTIME', 'FLEX_TIME', 'COMP_TIME', 'VACATION_ACCOUNT', 'SICK_LEAVE_ACCOUNT');

-- CreateEnum
CREATE TYPE "TimeRecordingMethod" AS ENUM ('MANUAL', 'AUTOMATIC', 'SHYFTPLAN', 'SAP_INTEGRATION', 'API_INTEGRATION');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('CREDIT', 'DEBIT');

-- CreateEnum
CREATE TYPE "ContractType" AS ENUM ('FULL_TIME', 'PART_TIME', 'TEMPORARY', 'CONTRACTOR', 'INTERN');

-- CreateEnum
CREATE TYPE "EmploymentStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'TERMINATED', 'SUSPENDED', 'ON_LEAVE');

-- CreateEnum
CREATE TYPE "PreferenceType" AS ENUM ('PREFERRED', 'AVAILABLE', 'UNAVAILABLE', 'RESTRICTED');

-- CreateEnum
CREATE TYPE "PreferenceReason" AS ENUM ('PERSONAL', 'MEDICAL', 'LEGAL', 'TRAINING', 'OTHER');

-- CreateEnum
CREATE TYPE "Permission" AS ENUM ('VIEW_SCHEDULE', 'EDIT_SCHEDULE', 'APPROVE_SCHEDULE', 'VIEW_STAFF', 'EDIT_STAFF', 'VIEW_REPORTS', 'EDIT_REPORTS', 'MANAGE_ABSENCES', 'MANAGE_VACATIONS', 'MANAGE_SHIFT_SWAPS', 'MANAGE_TIME_RECORDS', 'MANAGE_CONTRACTS', 'MANAGE_PERMISSIONS', 'SYSTEM_ADMIN');

-- CreateEnum
CREATE TYPE "IntegrationType" AS ENUM ('SAP', 'SHYFTPLAN', 'WORKDAY', 'BAMBOO_HR', 'CUSTOM_API', 'WEBHOOK');

-- CreateEnum
CREATE TYPE "IntegrationStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ERROR', 'SYNCING');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('SUCCESS', 'ERROR', 'PARTIAL');

-- AlterTable
ALTER TABLE "users" DROP COLUMN "role";

-- CreateTable
CREATE TABLE "working_time_accounts" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "accountType" "TimeAccountType" NOT NULL,
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "maxBalance" DOUBLE PRECISION,
    "minBalance" DOUBLE PRECISION,
    "year" INTEGER NOT NULL,
    "month" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "working_time_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "working_time_transactions" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "transactionType" "TransactionType" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "description" TEXT NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedBy" TEXT,
    "method" "TimeRecordingMethod" NOT NULL DEFAULT 'MANUAL',
    "notes" TEXT,

    CONSTRAINT "working_time_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_records" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "shiftId" TEXT,
    "clockIn" TIMESTAMP(3) NOT NULL,
    "clockOut" TIMESTAMP(3),
    "totalHours" DOUBLE PRECISION,
    "breakMinutes" INTEGER NOT NULL DEFAULT 0,
    "method" "TimeRecordingMethod" NOT NULL DEFAULT 'MANUAL',
    "location" TEXT,
    "deviceId" TEXT,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "time_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_contracts" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "contractType" "ContractType" NOT NULL,
    "employmentStatus" "EmploymentStatus" NOT NULL DEFAULT 'ACTIVE',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "probationEndDate" TIMESTAMP(3),
    "noticePeriod" INTEGER NOT NULL,
    "workingHoursPerWeek" DOUBLE PRECISION NOT NULL,
    "hourlyRate" DOUBLE PRECISION,
    "salary" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "benefits" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "qualifications" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "restrictions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "managerId" TEXT,
    "department" TEXT,
    "position" TEXT,
    "costCenter" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift_preferences" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "dayOfWeek" "DayOfWeek" NOT NULL,
    "shiftType" "ShiftType" NOT NULL,
    "preferenceType" "PreferenceType" NOT NULL,
    "reason" "PreferenceReason",
    "notes" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shift_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "permissions" "Permission"[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_role_assignments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "assignedBy" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "user_role_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_integrations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "IntegrationType" NOT NULL,
    "status" "IntegrationStatus" NOT NULL DEFAULT 'INACTIVE',
    "baseUrl" TEXT NOT NULL,
    "apiKey" TEXT,
    "apiSecret" TEXT,
    "username" TEXT,
    "password" TEXT,
    "config" JSONB,
    "lastSyncAt" TIMESTAMP(3),
    "syncInterval" INTEGER,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_sync_logs" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "syncType" TEXT NOT NULL,
    "status" "SyncStatus" NOT NULL,
    "recordsProcessed" INTEGER NOT NULL,
    "recordsCreated" INTEGER NOT NULL,
    "recordsUpdated" INTEGER NOT NULL,
    "recordsFailed" INTEGER NOT NULL,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "duration" INTEGER,

    CONSTRAINT "integration_sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "working_time_accounts_staffId_accountType_year_month_key" ON "working_time_accounts"("staffId", "accountType", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "shift_preferences_contractId_dayOfWeek_shiftType_key" ON "shift_preferences"("contractId", "dayOfWeek", "shiftType");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "user_role_assignments_userId_roleId_key" ON "user_role_assignments"("userId", "roleId");

-- AddForeignKey
ALTER TABLE "working_time_accounts" ADD CONSTRAINT "working_time_accounts_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "working_time_transactions" ADD CONSTRAINT "working_time_transactions_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "working_time_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "working_time_transactions" ADD CONSTRAINT "working_time_transactions_recordedBy_fkey" FOREIGN KEY ("recordedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_records" ADD CONSTRAINT "time_records_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_records" ADD CONSTRAINT "time_records_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_records" ADD CONSTRAINT "time_records_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_contracts" ADD CONSTRAINT "employee_contracts_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_contracts" ADD CONSTRAINT "employee_contracts_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_preferences" ADD CONSTRAINT "shift_preferences_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "employee_contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_role_assignments" ADD CONSTRAINT "user_role_assignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_role_assignments" ADD CONSTRAINT "user_role_assignments_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_role_assignments" ADD CONSTRAINT "user_role_assignments_assignedBy_fkey" FOREIGN KEY ("assignedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_sync_logs" ADD CONSTRAINT "integration_sync_logs_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "system_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
