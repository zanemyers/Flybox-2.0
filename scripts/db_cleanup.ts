import { JobStatus, prisma } from "@/server/db";
import { CATALOG_LIMIT, clientHashCutoff, ledgerCutoff, staleCutoff } from "@/server/retention";

// One pass over runs, then two over the ledger — its hash and its row go on different windows.

async function cleanup() {
  console.log("Starting cleanup...");

  // Three disjoint reasons, so the OFFSET subquery reads the pre-delete snapshot. Abandoned runs go outright, not FAILED first.
  const deleted = await prisma.$executeRaw`
    DELETE FROM "Job"
    WHERE "status" IN (${JobStatus.FAILED}::"JobStatus", ${JobStatus.CANCELED}::"JobStatus")
       OR ("status" = ${JobStatus.IN_PROGRESS}::"JobStatus" AND "heartbeatAt" < ${staleCutoff()})
       OR "id" IN (
            SELECT "id" FROM "Job"
            WHERE "status" = ${JobStatus.COMPLETED}::"JobStatus"
            ORDER BY "createdAt" DESC, "id" DESC
            OFFSET ${CATALOG_LIMIT}
          )
  `;
  console.log(`  deleted ${deleted} run(s) — failed, canceled, abandoned, or past the ${CATALOG_LIMIT}-run catalog`);

  // Pruned by its own window, never the catalog's — these rows are the only evidence a cap can count.
  const ledgerHashes = await prisma.runLedger.updateMany({
    where: { clientHash: { not: null }, createdAt: { lt: clientHashCutoff() } },
    data: { clientHash: null },
  });
  console.log(`  cleared the client hash on ${ledgerHashes.count} ledger row(s) past the per-client window`);

  const ledgerRows = await prisma.runLedger.deleteMany({ where: { createdAt: { lt: ledgerCutoff() } } });
  console.log(`  deleted ${ledgerRows.count} ledger row(s) past the longest rate-limit window`);
}

cleanup()
  .catch((err) => {
    console.error("Cleanup failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    // A disconnect that fails on the way out is not worth changing the exit code for.
    await prisma.$disconnect().catch(() => {});
  });
