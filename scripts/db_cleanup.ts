import { prisma } from "@/server/db";
import { JobStatus } from "@/server/constants";

async function cleanupOldJobs() {
    try {
        console.log("Starting cleanup...");

        // Delete all FAILED or CANCELED jobs
        console.log("Removing failed or canceled jobs...");
        await prisma.job.deleteMany({
            where: {
                status: { in: [JobStatus.FAILED, JobStatus.CANCELED] },
            },
        });

        // Keep 5 most recent COMPLETED jobs, delete the rest
        const recentCompleted = await prisma.job.findMany({
            where: { status: JobStatus.COMPLETED },
            orderBy: { createdAt: "desc" },
            take: 5,
            select: { id: true },
        });

        const keepIds = recentCompleted.map((job) => job.id);

        console.log("Removing old completed jobs...");
        await prisma.job.deleteMany({
            where: {
                status: JobStatus.COMPLETED,
                id: { notIn: keepIds },
            },
        });

        console.log("Finished!");
    } catch (err) {
        console.error("Error during cleanup:", err);
    } finally {
        await prisma.$disconnect();
    }
}

cleanupOldJobs()
    .catch((err) => {
        console.error("Cleanup failed:", err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
