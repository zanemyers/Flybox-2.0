import * as chrono from "chrono-node";
import type { Page } from "playwright"
import type { GoogleGenAI } from "@google/genai";

import { DIVIDER } from "@/lib/base/constants";
import { normalizeUrl } from "@/lib/base/scrapingUtils";
import { Anchor, SiteInfo } from "@/lib/base/types/taskTypes"


/**
 * Normalize URLs for each site and remove duplicates based on the normalized URLs.
 *
 * @param sites - Array of site objects with a `url` property.
 * @returns Promise resolving to an array of unique sites with normalized URLs.
 */
async function checkDuplicateSites(sites: SiteInfo[]): Promise<SiteInfo[]> {
    const urlsSet = new Set(); // Normalized URLs that have been processed
    const siteList = []; // Unique site objects with normalized URLs

    for (const site of sites) {
        const url = normalizeUrl(site.url);

        if (!urlsSet.has(url)) {
            urlsSet.add(url);
            siteList.push({ ...site, url }); // Add a copy of the site object with the normalized URL
        } else {
            console.warn("Duplicate found:", url); // Log duplicate URLs
        }
    }
    return siteList;
}

/**
 * Checks whether the target string contains any of the specified terms, case-insensitively.
 *
 * @param target - The string to search within.
 * @param terms - Array of terms to search for in the target string.
 * @returns True if any term is found in the target; otherwise false.
 */
function includesAny(target: string, terms: string[]): boolean {
    const lower = target.toLowerCase();
    return terms.some((term) => lower.includes(term.toLowerCase()));
}

/**
 * Retrieves all anchor (`<a>`) elements with an `href` attribute from the page,
 *
 * @param page - Playwright page instance to extract anchors from.
 * @returns Promise resolving to an array of objects where:
 *   - `href`: The full URL of the anchor's `href` attribute.
 *   - `text`: The anchor's visible text content, lowercased and trimmed.
 */
async function extractAnchors(page: Page): Promise<Anchor[]> {
    return await page.$$eval("a[href]", (anchors) =>
        anchors
            .filter((el): el is HTMLAnchorElement => el instanceof HTMLAnchorElement)
            .map((a) => ({
            href: a.href,
            text: a.textContent?.toLowerCase().trim() || "",
        }))
    );
}

/**
 * Scrapes the visible text content from the first element that matches the specified CSS selector.
 *
 * @param page - Playwright Page instance representing the browser page.
 * @param selector - CSS selector to find the target element.
 * @returns Promise resolving to the cleaned visible text if found; otherwise, null.
 */
async function scrapeVisibleText(page: Page, selector: string): Promise<string|null> {
    const element = await page.$(selector);
    if (!element) return null;

    // Evaluate visibility and extract text within the browser context
    return await element.evaluate((node) => {
        if (!(node instanceof HTMLElement)) return null;

        const style = window.getComputedStyle(node);
        const isVisible =
            style.display !== "none" && style.visibility !== "hidden" && node.offsetParent !== null;

        // If visible, return trimmed innerText with consecutive newlines replaced by single newlines
        return isVisible ? node.innerText.trim().replace(/\n{2,}/g, "\n") : null;
    });
}

/**
 * Determines the priority score for a hyperlink to guide scraping order.
 *
 * @param currentUrl - The URL of the page currently being scraped.
 * @param link - The href URL of the candidate link to evaluate.
 * @param linkText - The visible anchor text of the link.
 * @param siteInfo - Site metadata containing:
 * @returns Priority score where:
 *   - 0 means highest priority (follow immediately),
 *   - 1 means medium priority,
 *   - 2 means low priority,
 *   - Infinity means do not follow.
 */
function getPriority(currentUrl: string, link: string, linkText: string, siteInfo: SiteInfo): number {
    const currentUrlHasKeyword = includesAny(currentUrl, siteInfo.keywords); // Check if current URL contains keywords
    const hasKeyword = includesAny(link, siteInfo.keywords); // Check if link URL contains keywords
    const hasJunkWord = includesAny(link, siteInfo.junkWords); // Check if link URL contains junk words
    const hasClickPhrase = includesAny(linkText, siteInfo.clickPhrases); // Check if anchor text contains click phrases

    let priority = Infinity; // Default: do not follow

    if (hasKeyword && !hasJunkWord) {
        priority = 0; // Highest priority: relevant link without junk words
    } else if (currentUrlHasKeyword && hasClickPhrase) {
        priority = 1; // Medium priority: current URL relevant and link text invites clicking
    } else if (hasKeyword && hasJunkWord) {
        priority = 2; // Low priority: relevant link but contains junk terms
    }

    return priority;
}

/**
 * Parses text to find explicit date expressions and returns
 * the most recent valid date within a set range.
 *
 * @param text - The text to scan for date expressions.
 * @returns The most recent valid date found, or `null` if none match the criteria.
 */
function extractDate(text: string): Date | null {
    const currentYear = new Date().getFullYear();

    // Parse all date expressions using chrono-node
    const results = chrono.parse(text);

    // Extract valid dates, filter by range, sort by recency
    const validDates: Date[] = results
        .filter((result) => result.start.isCertain("year")) // only explicit years
        .map((result) => result.start.date())
        .filter((date) => {
            const year = date.getFullYear();
            return year >= 2020 && year <= currentYear;
        })
        .sort((a, b) => b.getTime() - a.getTime()); // most recent first

    return validDates[0] || null;
}

/**
 * Estimates the approximate number of tokens in the given text.
 * - Uses a heuristic that one word corresponds to about 1.3 tokens.
 *
 * @param text - The input text to estimate token count for.
 * @returns Estimated token count based on word count.
 */
function estimateTokenCount(text: string): number {
    // Split the trimmed text into words by whitespace
    const words = text?.trim()?.split(/\s+/).length || 0;
    return Math.ceil(words * 1.3); // Multiply the word count by 1.3 and round up
}

/**
 * Splits the full report text into smaller chunks, each staying within the token limit.
 *
 * The input text is divided into sections using the DIVIDER string.
 * Each chunk accumulates as many full sections as possible without exceeding
 * the specified token limit.
 *
 * @param text - The complete report text to be split into chunks.
 * @param tokenLimit - Maximum number of tokens allowed per chunk.
 * @returns An array of text chunks, each under the token limit.
 */
function chunkReportText(text: string, tokenLimit: number): string[] {
    const reports = text.split(DIVIDER);
    const chunks = []; // Array to hold resulting text chunks

    let currentChunk = ""; // Holds the accumulated text for the current chunk
    let currentTokens = 0; // Estimated token count of currentChunk

    for (const report of reports) {
        // Re-add DIVIDER to preserve section separation in chunks
        const section = report + DIVIDER;
        const tokens = estimateTokenCount(section);

        // If adding this section exceeds token limit, push current chunk and start a new one
        if (currentTokens + tokens > tokenLimit) {
            if (currentChunk) {
                chunks.push(currentChunk.trim());
            }
            currentChunk = section; // Start new chunk with current section
            currentTokens = tokens;
        } else {
            // Otherwise, append section to current chunk
            currentChunk += section;
            currentTokens += tokens;
        }
    }

    // Add any remaining chunk after loop ends
    if (currentChunk) {
        chunks.push(currentChunk.trim());
    }

    return chunks;
}

/**
 * Generates text content from the Google GenAI model based on the given prompt.
 *
 * @param ai - Instance of the GoogleGenAI client.
 * @param model - The name or identifier of the AI model to use.
 * @param prompt - The input prompt guiding the content generation.
 * @returns Resolves with the generated text, or an empty string if generation fails.
 */
async function generateContent(ai: GoogleGenAI, model: string, prompt: string): Promise<string> {
    const response = await ai.models.generateContent({
        model: model,
        contents: prompt,
    });

    return response?.text?.trim() || "";
}

export {
    checkDuplicateSites,
    chunkReportText,
    estimateTokenCount,
    extractAnchors,
    extractDate,
    generateContent,
    getPriority,
    includesAny,
    scrapeVisibleText,
};
