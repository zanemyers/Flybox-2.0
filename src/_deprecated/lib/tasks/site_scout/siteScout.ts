import BaseTask from "@/lib/base/baseTask";
import { ERRORS, JobStatus } from "@/lib/base/constants";
import { ExcelFileHandler } from "@/lib/base/fileUtils";
import { sameDomain } from "@/lib/base/scrapingUtils";
import { SiteScoutPayload } from "@/lib/base/types/taskTypes";

/**
 * SiteScout class merges URLs between a ShopReel report file and a
 * FishTales starter Excel file and saves the results to a new Excel file.
 *
 * Extends BaseApp to integrate with the job system (progress tracking,
 * cancellation, messages, and file attachments).
 */
export default class SiteScout extends BaseTask {
    private readonly files: SiteScoutPayload;
    private shopReelHandler: ExcelFileHandler = new ExcelFileHandler();
    private fishTalesHandler: ExcelFileHandler = new ExcelFileHandler();
    private updatedFile: ExcelFileHandler = new ExcelFileHandler();


    /**
     * @param jobId - Optional Job ID for tracking progress and associated files.
     * @param files - An object containing the two Excel files:
     */
    constructor(jobId: string, files: SiteScoutPayload) {
        super(jobId);
        this.files = files;
    }

    /**
     * Compares URLs between the ShopReel and FishTales files, identifies URLs
     * present in the ShopReel file but missing from the FishTales file, and
     * appends any missing URLs to the FishTales file.
     */
    async mergeMissingUrls() {
        await this.addJobMessage("Comparing report and site URLs...");

        try {
            // Load the Excel file buffers into their respective handlers
            await this.shopReelHandler.loadBuffer(await this.files.shopReelFile.arrayBuffer());
            await this.fishTalesHandler.loadBuffer(await this.files.fishTalesFile.arrayBuffer());

            await this.throwIfJobCanceled();

            // Extract URLs:
            // - Report URLs: all rows, using the "url" column
            // - Site URLs: only rows where "has_report" is true, using the "website" column
            const [rawReportUrls, rawSiteUrls] = await Promise.all([
                this.fishTalesHandler.read(
                    [],
                    () => true,
                    (row: { url: string }) => row["url"]
                ),
                this.shopReelHandler.read(
                    [],
                    (row: { has_report: boolean }) => row["has_report"],
                    (row: { website: string}) => row["website"]
                ),
            ]);

            // Deduplicate URLs
            const reportUrls = Array.from(new Set(rawReportUrls)) as string[];
            const siteUrls = Array.from(new Set(rawSiteUrls)) as string[];

            await this.throwIfJobCanceled();

            // Determine which site URLs are missing from the report file based on domain
            const missingUrls = siteUrls.filter(
                (siteUrl) => !reportUrls.some((reportUrl) => sameDomain(siteUrl, reportUrl))
            );

            if (missingUrls.length === 0) {
                await this.addJobMessage("✅ No missing URLs found.");
                await this.updateJobStatus(JobStatus.COMPLETED);
                return;
            }

            await this.addJobMessage(
                `Appending ${missingUrls.length} missing URLs to the report file...`
            );
            await this.throwIfJobCanceled();

            // Write existing report rows to the updated file
            await this.updatedFile.write(await this.fishTalesHandler.read());

            // Append missing URLs as new rows
            await this.updatedFile.write(
                missingUrls.map((url) => ({ url })),
                true
            );

            await this.addJobMessage("✅ FishTales starter file updated.");
            await this.addJobFile("primaryFile", await this.updatedFile.getBuffer()); // Save the updated file in the job system
            await this.updateJobStatus(JobStatus.COMPLETED);
        } catch (err) {
            // Handle errors (except job cancellation) and mark job as failed
            if (err instanceof Error && err.message !== ERRORS.CANCELED) {
                await this.addJobMessage(`❌ Error: ${err.message || err}`);
                await this.updateJobStatus(JobStatus.FAILED);
            }
        }
    }
}
