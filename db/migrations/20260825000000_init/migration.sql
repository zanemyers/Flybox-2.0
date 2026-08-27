-- Squashed baseline. The eight migrations before it were never released, and one of them added a column another dropped.

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'CANCELED', 'FAILED');

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "heartbeatAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "locationName" TEXT,
    "rivers" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "summarized" BOOLEAN NOT NULL DEFAULT false,
    "shopDirectory" BOOLEAN NOT NULL DEFAULT true,
    "primaryFile" BYTEA,
    "secondaryFile" BYTEA,
    "rawFile" BYTEA,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RunLedger" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clientHash" TEXT,

    CONSTRAINT "RunLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobMessage" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "message" TEXT NOT NULL,

    CONSTRAINT "JobMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Job_createdAt_idx" ON "Job"("createdAt");

-- CreateIndex
CREATE INDEX "Job_status_heartbeatAt_idx" ON "Job"("status", "heartbeatAt");

-- CreateIndex
CREATE INDEX "RunLedger_createdAt_idx" ON "RunLedger"("createdAt");

-- CreateIndex
CREATE INDEX "RunLedger_clientHash_createdAt_idx" ON "RunLedger"("clientHash", "createdAt");

-- AddForeignKey
ALTER TABLE "JobMessage" ADD CONSTRAINT "JobMessage_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

