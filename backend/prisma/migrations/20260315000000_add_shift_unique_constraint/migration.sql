-- Remove any duplicate shifts first (keep the most recently created one)
DELETE FROM "shifts" a
USING "shifts" b
WHERE a."staffId" = b."staffId"
  AND a."date" = b."date"
  AND a."createdAt" < b."createdAt";

-- AddUniqueConstraint: one staff member per day
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_staffId_date_key" UNIQUE ("staffId", "date");
