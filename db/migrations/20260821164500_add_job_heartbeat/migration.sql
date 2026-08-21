-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "heartbeatAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Existing IN_PROGRESS rows are orphans by definition: nothing is running that
-- could touch their heartbeat. Backdating them to createdAt lets the reaper
-- retire them on its first pass instead of granting a fresh grace period.
UPDATE "Job" SET "heartbeatAt" = "createdAt";

-- CreateIndex
CREATE INDEX "Job_status_heartbeatAt_idx" ON "Job"("status", "heartbeatAt");
