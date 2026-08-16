-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "clientHash" TEXT;

-- CreateIndex
CREATE INDEX "Job_createdAt_idx" ON "Job"("createdAt");

-- CreateIndex
CREATE INDEX "Job_clientHash_createdAt_idx" ON "Job"("clientHash", "createdAt");
