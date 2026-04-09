import { NextResponse } from "next/server";
import { prisma, type Job } from "@/lib/db";
import BaseAPI from "@/lib/base/baseAPI";
import ShopReel from "@/lib/tasks/shop_reel/shopReel";
import { ShopReelPayload, ApiFile } from "@/lib/base/types/taskTypes";
import { JobType, JobStatus } from "@/lib/base/constants"


/**
 * ShopReelAPI handles creating and tracking ShopReel scraping jobs.
 */
export class ShopReelAPI extends BaseAPI {
    /**
     * Creates a new ShopReel scraping job.
     *
     * @returns Responds with the new job ID and status
     */
    async handleCreateJob(req: Request) {
        try {
            // Create a new job in the database
            const job = await prisma.job.create({
                data: { type: JobType.SHOP_REEL, status: JobStatus.IN_PROGRESS },
            });

            // Determine payload: either a file upload or query parameters
            const formData = await req.formData();
            const payload: ShopReelPayload = {
                apiKey: null,
                query: null,
                lat: null,
                lng: null,
                maxResults: null,
                file: null
            }

            const file = formData.get("file") as File | null;
            if (file) {
                payload.file = file;
            } else {
                payload.apiKey = String(formData.get("apiKey"))
                payload.query = String(formData.get("searchTerm"))
                payload.lat = Number(formData.get("latitude"))
                payload.lng = Number(formData.get("longitude"))
                payload.maxResults = Number(formData.get("maxResults"))
            }

            // Start the scraper asynchronously
            const scraper = new ShopReel(job.id, payload);
            scraper.shopScraper().catch((err) => {
                console.error(`ShopScraper failed for job ${job.id}:`, err);
            });

            return NextResponse.json({ jobId: job.id, status: job.status }, { status: 201 });
        } catch (error) {
            return NextResponse.json({ error: `Failed to create ShopReel job: ${error}` }, {status: 500});
        }
    }

    /**
     * Returns a list of files available for download for a given ShopReel job.
     *
     * @param job - The job object containing file buffers (primaryFile, secondaryFile, etc.)
     * @returns Array of downloadable files
     */
    getFiles(job: Job): ApiFile[] {
        const files = [];

        if (job) {
            if (job.primaryFile) {
                files.push({
                    name: "shop_details.xlsx",
                    buffer: Buffer.from(job.primaryFile).toString("base64"),
                });
            }

            if (job.secondaryFile) {
                files.push({
                    name: "simple_shop_details.xlsx",
                    buffer: Buffer.from(job.secondaryFile).toString("base64"),
                });
            }
        }

        return files;
    }
}
