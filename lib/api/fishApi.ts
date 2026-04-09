import { NextResponse } from "next/server";

import { prisma, type Job } from "@/lib/db";
import BaseAPI from "@/lib/base/baseAPI";
import FishTales from "@/lib/tasks/fish_tales/fishTales";
import { FishTalesPayload, ApiFile } from "@/lib/base/types/taskTypes";
import { JobType, JobStatus } from "@/lib/base/constants"

/**
 * FishTalesAPI handles creating and tracking FishTales scraping jobs.
 */
export class FishTalesAPI extends BaseAPI {
    /**
     * Creates a new FishTales scraping job.
     **/
    async handleCreateJob(req: Request) {
        try {
            const job = await prisma.job.create({
                data: {type: JobType.FISH_TALES, status: JobStatus.IN_PROGRESS}
            });

            const formData = await req.formData();
            const payload: FishTalesPayload = {
                apiKey: String(formData.get("apiKey")),
                maxAge: Number(formData.get("maxAge")),
                filterByRivers: formData.get("filterByRivers") === "true",
                riverList: String(formData.get("riverList")).split(","),
                file: formData.get("file") as File,
                includeSiteList: formData.get("includeSiteList") === "true",
                tokenLimit: Number(formData.get("tokenLimit")),
                crawlDepth: Number(formData.get("crawlDepth")),
                model: String(formData.get("model")),
                summaryPrompt: String(formData.get("summaryPrompt")),
                mergePrompt: String(formData.get("mergePrompt")),
            };

            const scraper = new FishTales(job.id, payload);
            scraper.reportScraper().catch((err) => {
                console.error(`FishTales scraper failed for job ${job.id}:`, err);
            });

            return NextResponse.json({jobId: job.id, status: job.status}, {status: 201});
        } catch (error) {
            return NextResponse.json({ error: "Failed to create FishTales job" }, { status: 500 });
        }
    }

    /**
     * Returns a list of files available for download for a given FishTales job.
     *
     * @param job - The job object containing file buffers (primaryFile, secondaryFile, etc.)
     * @returns Array of downloadable files
     */
    getFiles(job: Job): ApiFile[] {
        const files = [];

        if (job) {
            if (job.primaryFile) {
                files.push({
                    name: "report_summary.txt",
                    buffer: Buffer.from(job.primaryFile).toString("base64"),
                });
            }

            if (job.secondaryFile) {
                files.push({
                    name: "site_list.txt",
                    buffer: Buffer.from(job.secondaryFile).toString("base64"),
                });
            }
        }

        return files;
    }
}
