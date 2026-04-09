import { prisma, type JobStatus as JSType} from "@/lib/db";
import { ERRORS, JobStatus } from "@/lib/base/constants";

/**
 * BaseApp provides utility methods for managing job records in the database.
 * Includes checking status, attaching files, adding/updating messages, and updating job status.
 */
export default class BaseTask {
    private readonly jobId: string;

    /**
     * @param jobId - The ID of the job to manage
     */
    constructor(jobId: string) {
        this.jobId = jobId;
    }

    /**
     * Checks whether the current job has been canceled.
     * If canceled, throws an Error with a predefined message from ERRORS.CANCELED.
     * Useful for stopping long-running or asynchronous processes early.
     *
     * @throws {Error} If the job status is CANCELED
     */
    async throwIfJobCanceled() {
        const job = await prisma.job.findUnique({
            where: { id: this.jobId },
            select: { status: true },
        });

        if (job && job.status === JobStatus.CANCELED) throw new Error(ERRORS.CANCELED);
    }

    /**
     * Attaches a binary file (Buffer) to a job record.
     *
     * @param field - Which file slot to use
     * @param buffer - The binary contents of the file
     */
    async addJobFile(field: "primaryFile" | "secondaryFile", buffer: ArrayBuffer) {
        await prisma.job.update({
            where: { id: this.jobId },
            data: { [field]: buffer },
        });
    }

    /**
     * Adds a new message to the job, or optionally updates the most recent message.
     *
     * @param text - The message text to add or update
     * @param [updateLast=false] - If true, updates the most recent message instead of creating a new one
     */
    async addJobMessage(text: string, updateLast: boolean = false) {
        const lastMessage = await prisma.jobMessage.findFirst({
            where: { jobId: this.jobId },
            orderBy: { createdAt: "desc" },
        });

        if (lastMessage && updateLast) {
            await prisma.jobMessage.update({
                where: { id: lastMessage.id },
                data: { message: text },
            });
        } else {
            await prisma.jobMessage.create({
                data: { jobId: this.jobId, message: text },
            });
        }
    }

    /**
     * Updates the status of the job to a new JobStatus value.
     *
     * @param status - The new status to set on the job
     */
    async updateJobStatus(status: JSType) {
        await prisma.job.update({
            where: { id: this.jobId },
            data: { status },
        });
    }
}
