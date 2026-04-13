import type { Browser, Page } from "playwright";
import { chromium } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import type { FetchResult } from "@/server/types/flybox";

chromium.use(StealthPlugin());

export class StealthBrowser {
  private browser: Browser | null = null;

  async launch(): Promise<void> {
    const headless = process.env.RUN_HEADLESS !== "false";
    this.browser = (await chromium.launch({ headless })) as unknown as Browser;
  }

  async fetchPage(url: string): Promise<FetchResult> {
    if (!this.browser) throw new Error("Browser not launched");
    let page: Page | null = null;
    try {
      page = await this.browser.newPage();
      await page.setExtraHTTPHeaders({
        "Accept-Language": "en-US,en;q=0.9",
      });
      const response = await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });
      const html = await page.content();
      const status = response?.status() ?? 0;
      return { html, status, blocked: false, jsRendered: true };
    } catch (err) {
      return {
        html: null,
        status: 0,
        blocked: false,
        jsRendered: false,
        error: String(err),
      };
    } finally {
      await page?.close();
    }
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

export function needsPlaywright(result: FetchResult): boolean {
  return result.blocked || result.jsRendered || result.html === null;
}
