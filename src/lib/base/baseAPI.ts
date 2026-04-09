import { prisma, type Job } from "@/lib/db";
import { JobStatus } from "@/lib/base/constants";
import {NextResponse} from "next/server";
import {ApiFile} from "@/lib/base/types/taskTypes";

/**
 * BaseAPI provides common job-related endpoints for polling, cancellation,
 * and job creation. Subclasses should extend this class to implement
 * application-specific job creation and file handling.
 */
export default abstract class BaseAPI {
    /**
     * Fetch updates for a job (status, progress messages, and any files).
     *
     * @param id - Job ID
     * @returns JSON with job status, concatenated messages, and files
     */
    async getJobUpdates(id: string) {
        try {
            const job = await prisma.job.findUnique({
                where: { id },
                include: { JobMessage: { orderBy: { createdAt: "asc" } } },
            });

            if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

            return NextResponse.json({
                status: job.status,
                message: job.JobMessage.map((m) => m.message).join("\n"),
                files: this.getFiles(job),
            });
        } catch (err) {
            return NextResponse.json({ error: "Failed to fetch job updates" }, { status: 500 });
        }
    }

    /**
     * Cancel a job by setting its status to CANCELED and appending a "Canceled" message.
     *
     * @param id - Job ID
     */
    async cancelJob(id: string) {
        try {
            await prisma.jobMessage.create({ data: { jobId: id, message: "❌ Canceled" }});
            await prisma.job.update({ where: { id },  data: { status: JobStatus.CANCELED }});

            return NextResponse.json({}, { status: 204 });
        } catch (err) {
            return NextResponse.json({ error: "Failed to cancel job" }, { status: 500 });
        }
    }

    /**
     * Subclasses MUST implement this to create and start a new job.
     */
    abstract handleCreateJob(req: Request): Promise<NextResponse>;

    /**
     * Subclasses MUST implement this to retrieve files for a job.
     */
    abstract getFiles(job: Job): ApiFile[];
}
