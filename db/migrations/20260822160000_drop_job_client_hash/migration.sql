-- RunLedger is what the rate limiter counts, so this copy of the hash was read by nothing. A Job
-- row also outlives every limit window it could have served, which meant the column identified a
-- visitor for no purpose at all. 20260816030658 added it; nothing released ever read it.
DROP INDEX "Job_clientHash_createdAt_idx";
ALTER TABLE "Job" DROP COLUMN "clientHash";
