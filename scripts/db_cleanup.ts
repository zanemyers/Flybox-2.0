import { CATALOG_LIMIT } from "@/server/catalog";
import { JobStatus, prisma } from "@/server/db";

/* Retention matches what /runs promises: the newest CATALOG_LIMIT completed runs
   are kept in full, files included, because every listed run offers downloads.
   Anything older is deleted outright. DETAILED_RUNS only controls how many show
   an inline preview, so it has no bearing on retention. The constant is imported
   rather than duplicated so the page and the pruner cannot drift apart. */

async function cleanupOldJobs() {
  console.log("Starting cleanup...");

  const failed = await prisma.job.deleteMany({
    where: { status: { in: [JobStatus.FAILED, JobStatus.CANCELED] } },
  });
  console.log(`  removed ${failed.count} failed/canceled job(s)`);

  const completed = await prisma.job.findMany({
    where: { status: JobStatus.COMPLETED },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  const keep = completed.slice(0, CATALOG_LIMIT);
  const drop = completed.slice(CATALOG_LIMIT).map((j) => j.id);

  /* Selecting ids explicitly rather than using `notIn` on the keep-list: Prisma
     treats `notIn: []` as matching everything, so an empty keep-list would
     delete the entire table. */
  if (drop.length) {
    const removed = await prisma.job.deleteMany({ where: { id: { in: drop } } });
    console.log(`  deleted ${removed.count} run(s) past the ${CATALOG_LIMIT}-run catalog`);
  }

  console.log(`Finished! Kept ${keep.length} completed run(s) with their files.`);
}

cleanupOldJobs()
  .catch((err) => {
    console.error("Cleanup failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
