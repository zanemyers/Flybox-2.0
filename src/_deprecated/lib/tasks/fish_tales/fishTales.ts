import "dotenv/config";
import { PromisePool } from "@supercharge/promise-pool";
import { GoogleGenAI } from "@google/genai";
import TinyQueue from "tinyqueue";
import { differenceInDays } from "date-fns";

import { DIVIDER, ERRORS } from "@/lib/base/constants";
import BaseTask from "@/lib/base/baseTask"
import { normalizeUrl, sameDomain } from "@/lib/base/scrapingUtils"
import StealthBrowser from "@/lib/base/stealthBrowser"
import { ExcelFileHandler, TXTFileHandler,} from "@/lib/base/fileUtils";
import { JobStatus } from "@/lib/base/constants";

import {
    checkDuplicateSites,
    chunkReportText,
    extractAnchors,
    extractDate,
    generateContent,
    getPriority,
    includesAny,
    scrapeVisibleText,
} from "./fishUtils";
import {CrawlSiteItem, SiteInfo} from "@/lib/base/types/taskTypes";

// Control concurrency of async scraping tasks
const CONCURRENCY = Math.max(1, parseInt(process.env.CONCURRENCY ?? "5", 10));

interface Params {
    apiKey: string;
    [key: string]: any; // Allow any other extra properties
}

/**
 * FishTales class handles scraping fishing reports from websites listed in a starter file,
 * filters them by date and content, and produces a summarized report using Gemini AI.
 *
 * Extends BaseApp to integrate with the job system (progress tracking,
 * cancellation, messages, and file attachments).
 */
export default class FishTales extends BaseTask {
    // File handlers
    private starterFileHandler: ExcelFileHandler = new ExcelFileHandler(); // Input site list (Excel)
    private siteListHandler: TXTFileHandler = new TXTFileHandler(); // Optional site list output
    private summaryHandler: TXTFileHandler = new TXTFileHandler(); // Final summary output

    // Browser with stealth mode to reduce bot detection
    private browser: StealthBrowser = new StealthBrowser({ headless: process.env.RUN_HEADLESS !== "false" });

    private failedDomains: string[] = []; // Keep track of sites that failed during scraping
    private readonly apiKey: string | undefined;
    private searchParams: Params;

    /**
     * @param jobId - Job ID for tracking progress and files.
     * @param searchParams - Parameters controlling scraping and summarization.
     */
    constructor(jobId: string, searchParams: Params) {
        super(jobId);
        this.searchParams = searchParams;

        // If the API key is set to "test" in dev mode, use GEMINI_API_KEY from env
        this.apiKey =
            this.searchParams.apiKey === "test" && process.env.NODE_ENV === "development"
                ? process.env.GEMINI_API_KEY
                : this.searchParams.apiKey;
    }

    /**
     * Orchestrates the FishTales job:
     * 1. Read and deduplicate sites from starter file.
     * 2. Crawl sites and scrape reports.
     * 3. Filter reports (by recency and rivers).
     * 4. Compile and summarize with Gemini AI.
     */
    async reportScraper() {
        try {
            // STEP 1: Read and deduplicate sites
            await this.addJobMessage("Reading Sites from file...");
            await this.starterFileHandler.loadBuffer(this.searchParams.file.buffer);
            await this.throwIfJobCanceled();

            const sites = await this.starterFileHandler.read(["keywords", "junk-words", "click-phrases"]);
            const siteList = await checkDuplicateSites(sites as SiteInfo[]);
            await this.addJobMessage(`✅ Found ${siteList.length} sites to scrape!`, true);
            await this.throwIfJobCanceled();

            // STEP 2: Scrape reports from sites
            const reports = await this.scrapeReports(siteList);
            await this.throwIfJobCanceled();

            // STEP 3: Filter and compile reports
            if (reports.length > 0) {
                await this.addJobMessage("Compiling reports...");
                const filteredReports = this.filterReports(reports);
                await this.throwIfJobCanceled();

                const compiledReports = filteredReports.join(DIVIDER);
                await this.addJobMessage("✅ Compiling complete!", true);

                // STEP 4: Summarize compiled reports with Gemini
                await this.addJobMessage("Generating report summary...");
                await this.generateSummary(compiledReports);

                if (this.failedDomains.length) {
                    console.warn(`Failed Pages\n${this.failedDomains.join("\n")}`);
                }

                await this.addJobMessage("✅ Finished!", true);
                await this.updateJobStatus(JobStatus.COMPLETED);
            }
        } catch (err) {
            if (err instanceof Error && err.message !== ERRORS.CANCELED) {
                await this.addJobMessage(`❌ Error: ${err.message || err}`);
                await this.updateJobStatus(JobStatus.FAILED);
            }
        }
    }

    /**
     * Scrape reports from multiple sites concurrently.
     *
     * @param sites - Site objects to crawl.
     * @returns Flattened list of scraped reports.
     */
    async scrapeReports(sites: SiteInfo[]): Promise<string[]> {
        let completed = 0;
        const messageTemplate = (done: number) => `Scraping sites (${done}/${sites.length}) for reports...`;

        try {
            await this.browser.launch();
            await this.addJobMessage(messageTemplate(completed));

            // Run site scraping in parallel with controlled concurrency
            const { results } = await PromisePool.withConcurrency(CONCURRENCY)
                .for(sites)
                .process(async (site) => {
                    await this.throwIfJobCanceled();

                    try {
                        const reports = await this.findReports(site);
                        await this.addJobMessage(messageTemplate(++completed), true);
                        return reports;
                    } catch (err) {
                        if (err instanceof Error) {
                            if (err.message !== ERRORS.CANCELED) throw err; // Bubble-up
                            this.failedDomains.push(`Error scraping ${site.url}: ${err.message || err}`);
                        }
                        return [];
                    }
                });

            await this.throwIfJobCanceled();

            // Flatten nested arrays and remove empty entries
            const reports = (results ?? []).flat().filter(Boolean);
            await this.addJobMessage(`✅ Found ${reports.length} total reports!`, true);

            // Save site list if requested
            if (this.searchParams.includeSiteList) {
                await this.addJobFile("secondaryFile", this.siteListHandler.getBuffer());
            }

            return reports;
        } catch (err) {
            if (err instanceof Error && err.message !== ERRORS.CANCELED) throw err; // Bubble-up
            await this.addJobMessage(`❌ Error: ${err}`, true);
            return [];
        } finally {
            await this.browser.close(); // Ensure browser shuts down regardless of success/failure
        }
    }

    /**
     * Crawl a single site to extract report texts.
     *
     * @param site - Site object with `url` and optional `selector`.
     * @returns List of extracted reports.
     */
    async findReports(site: SiteInfo): Promise<string[]> {
        const page = await this.browser.newPage();
        await this.browser.load(page, site.url)
        const visited = new Set<string>(); // URLs already visited
        const toVisit = new TinyQueue<CrawlSiteItem>([], (a, b) => a.priority - b.priority); // Priority queue for URLs to visit
        const reports: string[] = []; // Collected report texts

        // Seed with the starting page; lower priority number means higher priority
        toVisit.push({ url: site.url, priority: -1 });
        while (toVisit.length > 0 && visited.size < this.searchParams.crawlDepth) {
            await this.throwIfJobCanceled();

            const item = toVisit.pop(); // Get the next highest priority site
            if (!item) break; // or continue / throw
            const { url } = item;

            if (visited.has(url)) continue;
            visited.add(url);

            // Navigate to the page
            try {
                await this.browser.load(page, url);
            } catch (err) {
                if (err instanceof Error){
                    this.failedDomains.push(`Error navigating to ${url}:: ${err.message || err}`);
                }
                continue;
            }

            // Scrape visible content from subpages (not the homepage)
            if (url !== site.url) {
                await page.waitForSelector("body", { timeout: 10000 }).catch(() => {});
                const text = await scrapeVisibleText(page, site.selector);
                if (text) {
                    reports.push(`${text}\nSource: ${url}`);
                }
            }

            // Extract all anchor links from the page
            const pageLinks = await extractAnchors(page);

            for (const { href, text } of pageLinks) {
                if (!sameDomain(href, site.url)) continue;

                const link = normalizeUrl(href);
                if (visited.has(link)) continue;

                const priority = getPriority(url, link, text, site);
                if (priority !== Infinity) {
                    toVisit.push({ url: link, priority });
                }
            }
        }

        // Save crawl info if site list output is enabled
        if (this.searchParams.includeSiteList) {
            const visitedText = [...visited].map((site) => `\t${site}`).join("\n");
            const toVisitText = toVisit.data.map((item) => `\t${item.url}`).join("\n");

            if (visited.size >= this.searchParams.crawlDepth) {
                await this.siteListHandler.write("Reached crawl depth limit for this site.\n", true);
            }

            await this.siteListHandler.write(
                `VISITED:\n${visitedText}\nTO VISIT:\n${toVisitText}\n${DIVIDER}\n`,
                true
            );
        }

        await this.browser.close();
        return reports;
    }

    /**
     * Filter reports by recency, detected date, and optional river list.
     *
     * @param reports - Raw reports.
     * @returns Filtered reports.
     */
    filterReports(reports: string[]): string[] {
        const today = new Date();

        return reports.filter((report) => {
            const reportDate = extractDate(report);

            if (!reportDate) return false; // Excludes reports with no detectable date.
            if (differenceInDays(today, reportDate) > this.searchParams.maxAge) return false; // Excludes reports older than `maxAge` days.

            // Optionally requires mention of a river from `riverList`.
            return !(this.searchParams.filterByRivers && !includesAny(report, this.searchParams.riverList));
        });
    }

    /**
     * Generate a summarized report using Gemini AI.
     *
     * @param report - Compiled report text.
     */
    async generateSummary(report: string): Promise<void> {
        const ai = new GoogleGenAI({ apiKey: this.apiKey });

        try {
            // Split report into chunks respecting token limits
            const chunks = chunkReportText(report, this.searchParams.tokenLimit);

            // Summarize each chunk concurrently
            const { results, errors } = await PromisePool.withConcurrency(CONCURRENCY)
                .for(chunks)
                .process(async (chunk) => {
                    await this.throwIfJobCanceled();
                    return await generateContent(
                        ai,
                        this.searchParams.model,
                        `${chunk}\n\n${this.searchParams.summaryPrompt}`
                    );
                });

            if (errors.length > 0) {
                console.warn("Some summaries failed:", errors);
            }

            if (results.length === 0) {
                await this.addJobMessage("❌ No summaries generated. Skipping final summary.", true);
                return;
            }

            await this.throwIfJobCanceled();

            // Merge chunk summaries into a final summary
            const finalResponse = await generateContent(
                ai,
                this.searchParams.model,
                `${this.searchParams.mergePrompt}\n\n${results.join("\n\n")}`
            );

            // Save the final summary to a text file and attach it's buffer as the job's primary file
            await this.summaryHandler.write(finalResponse);
            await this.addJobFile("primaryFile", this.summaryHandler.getBuffer());
        } catch (err) {
            if (err instanceof Error && err.message !== ERRORS.CANCELED) throw err; // Bubble-up
            await this.addJobMessage(`❌ Error generating summary: ${err}`, true);
        }
    }
}
