-- CreateTable
-- Purely additive: nothing on "Job" changes, so a rollback to the previous release meets a schema
-- it still understands. "Job"."clientHash" stays until the release after this one for that reason.
--
-- Starts empty, which means the caps read zero for existing traffic on the first deploy. That is
-- the safe direction and it self-corrects within one window: the alternative is backfilling from
-- "Job", whose rows are exactly the ones retention has already been deleting.
CREATE TABLE "RunLedger" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clientHash" TEXT,

    CONSTRAINT "RunLedger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RunLedger_createdAt_idx" ON "RunLedger"("createdAt");

-- CreateIndex
CREATE INDEX "RunLedger_clientHash_createdAt_idx" ON "RunLedger"("clientHash", "createdAt");
