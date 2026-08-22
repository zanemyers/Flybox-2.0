-- AlterTable
-- Defaults true: every run that already exists was given a workbook, so the
-- catalog must keep offering it for them.
ALTER TABLE "Job" ADD COLUMN     "shopDirectory" BOOLEAN NOT NULL DEFAULT true;
