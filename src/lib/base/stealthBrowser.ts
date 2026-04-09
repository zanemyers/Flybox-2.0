import { chromium } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import type {Browser, BrowserContext, Page, Response} from "playwright"

import { BLOCKED_OR_FORBIDDEN } from "@/lib/base/constants";


// Enable plugins
chromium.use(StealthPlugin());

/**
 * StealthBrowser wraps a Playwright Chromium browser with additional features
 * to mimic human browsing behavior and avoid bot detection.
 *
 * Features include:
 * - Randomized user agent, locale, timezone, and viewport size.
 * - Headless or headed mode configuration.
 * - Custom page helpers for element scraping, navigation, and basic user interaction.
 * - Automatic retries for page navigation and detection of blocked/forbidden responses.
 *
 * This class is designed for web scraping workflows where stealth and realistic browsing
 * are required to minimize detection or throttling by target websites.
 */
export default class StealthBrowser {
    private readonly headless: boolean;
    private readonly args: string[];
    private readonly userAgent: string;
    private readonly locale: string;
    private readonly timezoneId: string;
    private browser: Browser | null;
    private context: BrowserContext | null;

    /**
     * Creates an instance of StealthBrowser with configurable options.
     *
     * @param options - Optional configuration.
     * @param options.headless=true - Run browser in headless mode.
     * @param options.args - Chromium launch arguments.
     * @param options.userAgent - Override default user agent string.
     * @param options.locale - Override browser locale (e.g., "en-US").
     * @param options.timezoneId - Override browser timezone (e.g., "America/New_York").
     */
    constructor(options:Record<string, any> = {}) {
        this.headless = options.headless ?? true;
        this.args = options.args ?? ["--start-maximized", "--no-sandbox"];

        const agentProfile = this._getAgentProfile();
        this.userAgent = options.userAgent ?? agentProfile.userAgent;
        this.locale = options.locale ?? agentProfile.locale;
        this.timezoneId = options.timezoneId ?? agentProfile.timezoneId;

        this.browser = null;
        this.context = null;
    }

    /**
     * Returns a random user agent profile with userAgent, locale, and timezone.
     * Used for stealth to mimic diverse browsers and regions.
     *
     * @returns Random user agent profile.
     */
    _getAgentProfile(): {userAgent: string; locale: string, timezoneId: string} {
        const agentProfiles = [
            {
                userAgent:
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
                locale: "en-US",
                timezoneId: "America/New_York",
            },
            {
                userAgent: "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:114.0) Gecko/20100101 Firefox/114.0",
                locale: "de-DE",
                timezoneId: "Europe/Berlin",
            },
            {
                userAgent:
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36",
                locale: "en-GB",
                timezoneId: "Europe/London",
            },
            {
                userAgent:
                    "Mozilla/5.0 (Linux; Android 10; Pixel 4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Mobile Safari/537.36",
                locale: "en-CA",
                timezoneId: "America/Toronto",
            },
        ];

        return agentProfiles[Math.floor(Math.random() * agentProfiles.length)];
    }

    /**
     * Returns a random viewport size from common screen resolutions.
     *
     * @returns Viewport dimensions.
     */
    _getViewport(): { width: number; height: number; } {
        const viewports = [
            { width: 1366, height: 768 },
            { width: 1440, height: 900 },
            { width: 1536, height: 864 },
            { width: 1920, height: 1080 },
            { width: 1280, height: 800 },
        ];

        return viewports[Math.floor(Math.random() * viewports.length)];
    }

    /**
     * Sets up request interception to reduce bandwidth and speed up scraping.
     * Blocks images, fonts, stylesheets, media, and common analytics/ads,
     * but allows scripts, XHR/fetch, and HTML to ensure content loads correctly.
     *
     * @param page
     */
    async _setupRequestInterception(page: Page) {
        await page.route("**/*", (route) => {
            const type = route.request().resourceType();
            const url = route.request().url();

            // List of resource types to block
            const blockedTypes = ["image", "font", "stylesheet", "media"];

            // Block analytics / ad URLs (add more patterns as needed)
            const blockedUrls = [
                "google-analytics",
                "doubleclick.net",
                "ads.",
                "googletagmanager.com",
                "facebook.net",
                "tiktok.com/tracker",
            ];

            if (blockedTypes.includes(type) || blockedUrls.some((pattern) => url.includes(pattern))) {
                route.abort();
            } else {
                route.continue();
            }
        });
    }

    /**
     * Launches the Chromium browser and creates a new browser context
     * with the configured viewport, user agent, locale, and timezone.
     *
     * @returns Returns the instance for chaining.
     */
    async launch(): Promise<this> {
        this.browser = await chromium.launch({
            headless: this.headless,
            args: this.args,
        });

        this.context = await this.browser.newContext({
            viewport: this._getViewport(),
            userAgent: this.userAgent,
            locale: this.locale,
            timezoneId: this.timezoneId,
        });

        return this;
    }

    /**
     * Simulates basic user interactions such as mouse movements.
     * Helps reduce bot detection.
     */
    protected async simulateUserInteraction(page: Page): Promise<void> {
        await page.mouse.move(100, 100);
        await page.mouse.move(200, 300);
        await page.mouse.move(50, 175);
    }

    /**
     * Navigates to a URL with retry support.
     *
     * @param page - Playwright page
     * @param url - URL to navigate to.
     * @param retries=2 - Maximum retry attempts.
     * @returns Navigation response.
     * @throws {Error} If navigation fails or site is blocked/forbidden.
     */
    async load(page: Page, url: string, retries: number = 2): Promise<Response> {
        while (retries--) {
            try {
                const response = await page.goto(url, {
                    waitUntil: "domcontentloaded",
                    timeout: 15000,
                });

                if (response) {
                    const status = response.status();
                    if ([401, 403, 429].includes(status)) {
                        const content = await page.content();
                        if (BLOCKED_OR_FORBIDDEN.some((text) => content.includes(text))) {
                            throw new Error(`Blocked or forbidden (HTTP ${status})`);
                        }
                    }

                    await this.simulateUserInteraction(page);
                    return response;
                }
            } catch (err: unknown) {
                if (err instanceof Error && (retries === 0 || /HTTP (401|403|429)/.test(err.message))) {
                    throw new Error(`Failed to load ${url}: ${err.message}`);
                }
                await new Promise((res) => setTimeout(res, 1000));
            }
        }
        throw new Error(`Failed to load ${url}: retries exhausted`);
    }



    /**
     * Creates a new page in the browser context and applies custom helper methods.
     *
     * @returns New page with stealth helpers.
     */
    async newPage(): Promise<Page> {
        if (this.context) {
            const page = await this.context.newPage();
            await this._setupRequestInterception(page);
            return page;
        }
        throw new Error(`Failed to create new page, browser context doesn't exist`);
    }

    /**
     * Closes the browser instance if it is running.
     */
    async close(): Promise<void> {
        if (this.browser) {
            await this.browser.close();
        }
    }
}