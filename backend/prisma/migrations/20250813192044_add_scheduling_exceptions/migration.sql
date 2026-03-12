-- CreateTable
CREATE TABLE "scheduling_exceptions" (
    "id" TEXT NOT NULL,
    "shiftId" TEXT,
    "ruleId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheduling_exceptions_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "scheduling_exceptions" ADD CONSTRAINT "scheduling_exceptions_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduling_exceptions" ADD CONSTRAINT "scheduling_exceptions_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
