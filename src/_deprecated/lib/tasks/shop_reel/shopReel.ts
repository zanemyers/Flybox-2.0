import "dotenv/config";
import { getJson } from "serpapi";
import { PromisePool } from "@supercharge/promise-pool";
import { JobStatus, ERRORS, FALLBACK_DETAILS } from "@/lib/base/constants";
import BaseTask from "@/lib/base/baseTask";
import { ExcelFileHandler} from "@/lib/base/fileUtils";
import StealthBrowser from "@/lib/base/stealthBrowser"
import { normalizeUrl } from "@/lib/base/scrapingUtils";
import type { Page } from "playwright"

import { getEmail, hasOnlineShop, getSocialMedia, publishesFishingReport, buildCacheFileRows, buildShopRows } from "./shopUtils";
import {BasicShop, Shop, ShopDetails, ShopReelPayload} from "@/lib/base/types/taskTypes";

/**
 * ShopReel class handles scraping shops from Google Maps via SerpAPI,
 * fetching additional website details, and saving results to Excel.
 *
 * Extends BaseApp to integrate with the job system (progress tracking,
 * cancellation, messages, and file attachments).
 */
export default class ShopReel extends BaseTask {
    private searchParams: ShopReelPayload;
    private shopWriter: ExcelFileHandler = new ExcelFileHandler(); // Excel writer for results
    private websiteCache = new Map<string, ShopDetails>();  // Cache for previously scraped website details
    private browser: StealthBrowser = new StealthBrowser({headless: process.env.RUN_HEADLESS !== "false"});

    /**
     * @param jobId - Job ID for tracking progress and files
     * @param searchParams - Parameters for the shop search
     */
    constructor(jobId: string, searchParams: ShopReelPayload) {
        super(jobId);
        this.searchParams = searchParams;
    }

    /**
     * Executes the full shop scraping workflow:
     * 1. Fetches shop results (SerpAPI or cached)
     * 2. Scrapes website details for each shop
     * 3. Writes the combined data to Excel
     *
     * Updates job messages, attaches files, and sets job status accordingly.
     */
    async shopScraper() {
        try {
            await this.addJobMessage("Searching for shops...");
            const shops = await this.fetchShops();
            await this.addJobMessage(`✅ Found ${shops.length} shops.`, true);

            await this.throwIfJobCanceled();
            const shopDetails = await this.getDetails(shops);

            await this.throwIfJobCanceled();
            await this.addJobMessage("📝 Writing shop data to Excel...");
            const rows = buildShopRows(shops, shopDetails);
            await this.shopWriter.write(rows);

            await this.addJobMessage("✅ Excel file created.", true);
            await this.addJobFile("primaryFile", await this.shopWriter.getBuffer());
            await this.updateJobStatus(JobStatus.COMPLETED);
        } catch (err) {
            if (err instanceof Error && err.message !== ERRORS.CANCELED) {
                await this.addJobMessage(`❌ Error: ${err.message || err}`);
                await this.updateJobStatus(JobStatus.FAILED);
            }
        } finally {
            await this.browser.close();
        }
    }

    /**
     * Fetches shops from SerpAPI or loads them from a cached Excel file.
     *
     * @returns Array of shop objects
     */
    async fetchShops(): Promise<BasicShop[]> {
        const cacheFileHandler = new ExcelFileHandler();

        const fileBuffer = await this.searchParams?.file?.arrayBuffer();
        if (fileBuffer) { // Return cached shops if buffer provided
            await cacheFileHandler.loadBuffer(fileBuffer);
            return await cacheFileHandler.read() as BasicShop[];
        }

        // Use the environment variable SERP_API_KEY for development/testing if the provided apiKey is "test";
        // Otherwise, use the actual apiKey
        const apiKey =
            this.searchParams.apiKey === "test" && process.env.NODE_ENV === "development"
                ? process.env.SERP_API_KEY
                : this.searchParams.apiKey;

        const results = [];

        // Fetch in pages of 20 until maxResults
        for (let start = 0; start < (+(this.searchParams.maxResults ?? 100) || 100); start += 20) {
            await this.throwIfJobCanceled();

            const data = await getJson({
                engine: "google_maps",
                q: this.searchParams.query,
                ll: `@${this.searchParams.lat},${this.searchParams.lng},10z`,
                start,
                type: "search",
                api_key: apiKey,
            });

            const pageResults = data?.local_results || [];
            results.push(...pageResults);

            if (pageResults.length < 20) break; // Last page
        }

        // Save results to secondary file if any found
        if (results.length > 0) {
            await cacheFileHandler.write(buildCacheFileRows(results));
            await this.addJobFile("secondaryFile", await cacheFileHandler.getBuffer());
        }

        return results;
    }

    /**
     * Scrapes website details for each shop with concurrency control.
     *
     * @param shops - Array of shop objects
     * @returns Array of shop detail objects
     */
    async getDetails(shops: BasicShop[]): Promise<ShopDetails[]> {
        const results = new Array(shops.length);
        let completed = 0;

        await this.browser.launch();
        const messageTemplate = (done: number) => `Scraping shops (${done}/${shops.length})`;
        await this.addJobMessage(messageTemplate(completed));

        await PromisePool.withConcurrency(parseInt(process.env.CONCURRENCY ?? "5", 10))
            .for(shops)
            .process(async (shop, index) => {
                if (!shop.website) {
                    results[index] = FALLBACK_DETAILS.NONE;
                } else {
                    await this.throwIfJobCanceled();
                    const page = await this.browser.newPage();
                    try {
                        results[index] = await this.scrapeWebsite(page, shop.website);
                    } catch (err) {
                        if (err instanceof Error && err.message !== ERRORS.CANCELED) {
                            console.warn(`⚠️ Failed to get details for ${shop.title}`, err);
                            results[index] = FALLBACK_DETAILS.ERROR;
                        }
                    } finally {
                        await page.close();
                    }
                }

                await this.addJobMessage(messageTemplate(++completed), true);
            });

        await this.addJobMessage("✅ Scraping Complete", true);
        return results;
    }

    /**
     * Scrapes a single shop's website for emails, online sales, fishing reports, and social media.
     *
     * Uses cached results if available to avoid redundant scraping.
     *
     * @param page - Playwright page instance
     * @param url - Shop website URL
     * @returns Scraped details or fallback values
     */
    async scrapeWebsite(page: Page, url: string): Promise<ShopDetails> {
        const normalizedUrl = normalizeUrl(url);

        const cached = this.websiteCache.get(normalizedUrl);
        if (cached) return cached;

        let details: ShopDetails;
        try {
            await this.throwIfJobCanceled();
            const response = await this.browser.load(page, normalizedUrl);

            const status = response?.status();
            if ([403, 429].includes(status)) {
                details = FALLBACK_DETAILS.BLOCKED(status);
            } else {
                details = {
                    email: await getEmail(page, (url) => this.browser.load(page, url)),
                    sellsOnline: await hasOnlineShop(page),
                    fishingReport: await publishesFishingReport(page),
                    socialMedia: await getSocialMedia(page),
                };
            }
        } catch {
            details = FALLBACK_DETAILS.TIMEOUT;
        }

        this.websiteCache.set(normalizedUrl, details);
        return details;
    }
}
