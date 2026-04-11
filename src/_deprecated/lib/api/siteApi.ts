import { NextResponse } from "next/server";

import { prisma, type Job } from "@/lib/db";
import BaseAPI from "@/lib/base/baseAPI";
import SiteScout from "@/lib/tasks/site_scout/siteScout";
import { SiteScoutPayload, ApiFile } from "@/lib/base/types/taskTypes";
import { JobType, JobStatus } from "@/lib/base/constants"


/**
 * SiteScoutAPI handles creating and tracking SiteScout jobs.
 */
export class SiteScoutAPI extends BaseAPI {
    /**
     * Creates a new SiteScout job.
     */
    async handleCreateJob(req: Request) {
        try {
            const job = await prisma.job.create({
                data: { type: JobType.SITE_SCOUT, status: JobStatus.IN_PROGRESS },
            });

            const formData = await req.formData()
            const payload: SiteScoutPayload = {
                shopReelFile: formData.get("shopReelFile") as File,
                fishTalesFile: formData.get("fishTalesFile") as File,
            }

            const scout = new SiteScout(job.id, payload);
            scout.mergeMissingUrls().catch((err) => {
                console.error(`SiteScout failed for job ${job.id}:`, err);
            });

            return NextResponse.json({jobId: job.id, status: job.status}, {status: 201});
        } catch (error) {
            return NextResponse.json({ error: "Failed to create ShopReel job" }, { status: 500 });
        }
    }

    /**
     * Returns a list of files available for download for a given SiteScout job.
     *
     * @param job - The job object containing file buffers (primaryFile, secondaryFile, etc.)
     * @returns Array of downloadable files
     */
    getFiles(job: Job): ApiFile[] {
        const files = [];

        if (job && job.primaryFile) {
            files.push({
                name: "new_fishTales_starter.xlsx",
                buffer: Buffer.from(job.primaryFile).toString("base64"),
            });
        }

        return files;
    }
}
