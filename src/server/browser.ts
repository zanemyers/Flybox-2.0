import type { Browser, Page } from "playwright";
import { chromium } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { checkUrl } from "@/server/net";

export interface FetchResult {
  html: string | null;
  status: number;
  blocked: boolean;
  jsRendered: boolean;
  error?: string;
  /** Declined by net.ts. No transport will do better, so needsPlaywright() must not retry it. */
  refused?: boolean;
}

const BLOCKED_RESOURCE_TYPES = ["image", "media", "font", "stylesheet"];

const VIEWPORTS = [
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
  { width: 1366, height: 768 },
];

function randomViewport() {
  return VIEWPORTS[Math.floor(Math.random() * VIEWPORTS.length)];
}

chromium.use(StealthPlugin());

export class StealthBrowser {
  private browser: Browser | null = null;

  async launch(): Promise<void> {
    const headless = process.env.RUN_HEADLESS !== "false";
    this.browser = (await chromium.launch({ headless })) as unknown as Browser;
  }

  async fetchPage(url: string): Promise<FetchResult> {
    if (!this.browser) throw new Error("Browser not launched");

    const verdict = await checkUrl(url);
    if (!verdict.ok) return { html: null, status: 0, blocked: false, jsRendered: false, refused: true, error: verdict.reason };

    let page: Page | null = null;
    try {
      page = await this.browser.newPage();

      await page.setViewportSize(randomViewport());
      await page.setExtraHTTPHeaders({
        "Accept-Language": "en-US,en;q=0.9",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Encoding": "gzip, deflate, br",
      });

      await page.route("**/*", async (route) => {
        // Block unnecessary resources to speed up page loads
        if (BLOCKED_RESOURCE_TYPES.includes(route.request().resourceType())) return route.abort();

        // Each redirect hop re-enters here as a fresh document request; page.goto follows them internally.
        if (route.request().resourceType() === "document" && !(await checkUrl(route.request().url())).ok) {
          return route.abort("blockedbyclient");
        }

        return route.continue();
      });

      const response = await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });

      const status = response?.status() ?? 0;

      if (status === 403 || status === 429) {
        return { html: null, status, blocked: true, jsRendered: false };
      }

      const html = await page.content();
      return { html, status, blocked: false, jsRendered: true };
    } catch (err) {
      return { html: null, status: 0, blocked: false, jsRendered: false, error: String(err) };
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
  // A refusal is a policy decision, not a transport failure — a browser would be refused too.
  if (result.refused) return false;
  return result.blocked || result.jsRendered || result.html === null;
}
