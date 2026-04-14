import { GoogleGenAI } from "@google/genai";
import { PromisePool } from "@supercharge/promise-pool";
import * as cheerio from "cheerio";
import { getJson } from "serpapi";
import TinyQueue from "tinyqueue";
import { StealthBrowser as Browser, needsPlaywright, type StealthBrowser } from "@/server/browser";
import { JobContext } from "@/server/db";
import { ExcelFileHandler, type SiteInfo, TXTFileHandler } from "@/server/fileUtils";
import { extractAnchors, httpFetch, isAllowedByRobots, normalizeUrl, sameDomain, scrapeShopDetails, scrapeVisibleText } from "@/server/scrapingUtils";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FlyboxPayload {
  serpApiKey: string;
  geminiApiKey: string;
  searchTerm: string;
  latitude: number;
  longitude: number;
  rivers: string[];
  summaryPrompt: string;
}

interface BasicShop {
  name: string;
  website: string;
  address: string;
  phone: string;
  stars: string;
  reviews: string;
  category: string;
}

// ── Messages / fallbacks ──────────────────────────────────────────────────────
const MESSAGES = {
  ERROR_BLOCKED_FORBIDDEN: (status: number) => `Blocked or Forbidden link (HTTP ${status})`,
  ERROR_EMAIL: "Errored while checking for an email",
  ERROR_LOAD_FAILED: "Page load failed",
  ERROR_REPORT: "Errored while checking for reports",
  ERROR_SHOP: "Errored while checking for an online shop",
  ERROR_SOCIAL: "Error while checking for social media",
  NO_CATEGORY: "No Category",
  NO_EMAIL: "No Email",
  NO_REVIEWS: "No Reviews",
  NO_STARS: "No Stars",
};

const FALLBACK_DETAILS = {
  BLOCKED: (status: number) => ({
    email: MESSAGES.ERROR_BLOCKED_FORBIDDEN(status),
    sellsOnline: MESSAGES.ERROR_BLOCKED_FORBIDDEN(status),
    fishingReport: MESSAGES.ERROR_BLOCKED_FORBIDDEN(status),
    socialMedia: [MESSAGES.ERROR_BLOCKED_FORBIDDEN(status)],
  }),
  ERROR: {
    email: MESSAGES.ERROR_EMAIL,
    sellsOnline: MESSAGES.ERROR_SHOP,
    fishingReport: MESSAGES.ERROR_REPORT,
    socialMedia: [MESSAGES.ERROR_SOCIAL],
  },
  NONE: {
    email: "",
    sellsOnline: false,
    fishingReport: false,
    socialMedia: [] as string[],
  },
  TIMEOUT: {
    email: MESSAGES.ERROR_LOAD_FAILED,
    sellsOnline: MESSAGES.ERROR_LOAD_FAILED,
    fishingReport: MESSAGES.ERROR_LOAD_FAILED,
    socialMedia: [MESSAGES.ERROR_LOAD_FAILED],
  },
};

// ── Shop phase ────────────────────────────────────────────────────────────────
async function fetchShopsPage(payload: FlyboxPayload, start: number, log: (msg: string) => Promise<void>): Promise<BasicShop[]> {
  try {
    const { serpApiKey, searchTerm, latitude, longitude } = payload;
    const data = await getJson({ engine: "google_maps", api_key: serpApiKey, q: searchTerm, ll: `@${latitude},${longitude},8z`, type: "search", start });
    return ((data.local_results ?? []) as Record<string, unknown>[]).map((r) => ({
      name: String(r.title ?? ""),
      website: String(r.website ?? ""),
      address: String(r.address ?? ""),
      phone: String(r.phone ?? ""),
      stars: r.rating !== undefined ? String(r.rating) : MESSAGES.NO_STARS,
      reviews: r.reviews !== undefined ? String(r.reviews) : MESSAGES.NO_REVIEWS,
      category: Array.isArray(r.types) ? r.types[0] : String(r.type ?? MESSAGES.NO_CATEGORY),
    }));
  } catch (err) {
    await log(`  ⚠️ Failed to fetch results at offset ${start}: ${String(err)}`);
    return [];
  }
}

async function scrapeShop(shop: BasicShop, browser: StealthBrowser, log: (msg: string) => Promise<void>): Promise<SiteInfo> {
  if (!shop.website) return { ...shop, ...FALLBACK_DETAILS.NONE };

  if (!(await isAllowedByRobots(shop.website))) {
    await log(`  🤖 Skipping ${shop.name} — disallowed by robots.txt`);
    return { ...shop, ...FALLBACK_DETAILS.NONE };
  }

  let result = await httpFetch(shop.website);
  if (needsPlaywright(result)) {
    await log(`  ↩ Playwright fallback: ${shop.name}`);
    result = await browser.fetchPage(shop.website);
  }

  if (!result.html) return { ...shop, ...FALLBACK_DETAILS.TIMEOUT };
  if (result.blocked) return { ...shop, ...FALLBACK_DETAILS.BLOCKED(result.status) };

  try {
    const $ = cheerio.load(result.html);
    const details = await scrapeShopDetails($, shop.website, browser);
    return { ...shop, ...details, email: details.email || MESSAGES.NO_EMAIL };
  } catch {
    return { ...shop, ...FALLBACK_DETAILS.ERROR };
  }
}

async function runShopPhase(
  payload: FlyboxPayload,
  browser: StealthBrowser,
  log: (msg: string) => Promise<void>,
  isCanceled: () => Promise<boolean>,
): Promise<SiteInfo[]> {
  await log("🔍 Searching for shops via SerpAPI…");

  const pages = await Promise.all([0, 20, 40, 60, 80].map((start) => fetchShopsPage(payload, start, log)));

  const seen = new Set<string>();
  const shops: BasicShop[] = [];
  for (const page of pages) {
    for (const shop of page) {
      const key = shop.website || shop.name;
      if (!seen.has(key)) {
        seen.add(key);
        shops.push(shop);
      }
    }
  }
  const deduped = shops.slice(0, 100);
  await log(`📋 Found ${deduped.length} shops. Scraping websites…`);

  const results: SiteInfo[] = deduped.filter((s) => !s.website).map((s) => ({ ...s, ...FALLBACK_DETAILS.NONE }));
  const withWebsite = deduped.filter((s) => s.website);
  let scraped = 0;

  await PromisePool.withConcurrency(10)
    .for(withWebsite)
    .process(async (shop) => {
      if (await isCanceled()) return;
      results.push(await scrapeShop(shop, browser, log));
      scraped++;
      if (scraped % 10 === 0) await log(`  … scraped ${scraped}/${withWebsite.length}`);
    });

  await log(`✅ Shop phase complete. ${results.filter((s) => s.fishingReport === true).length} shops publish fishing reports.`);
  return results;
}

// ── Crawl phase ───────────────────────────────────────────────────────────────

const MAX_DEPTH = 20;
const TOKEN_CHAR_LIMIT = 200_000;
const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_FALLBACK_MODEL = "gemini-2.0-flash";

function getPriority(href: string, text: string): number {
  const combined = `${href} ${text}`.toLowerCase();
  if (combined.includes("report")) return 0;
  if (combined.includes("fishing") || combined.includes("fish")) return 1;
  if (combined.includes("conditions") || combined.includes("hatch")) return 2;
  return 3;
}

async function crawlSite(baseUrl: string, browser: StealthBrowser): Promise<string> {
  const visited = new Set<string>();
  const queue = new TinyQueue<{ url: string; depth: number; priority: number }>(
    [{ url: normalizeUrl(baseUrl), depth: 0, priority: 0 }],
    (a, b) => a.priority - b.priority,
  );
  const chunks: string[] = [];
  let totalChars = 0;

  while (queue.length > 0 && totalChars < TOKEN_CHAR_LIMIT) {
    const item = queue.pop();
    if (!item) break;
    const { url, depth } = item;

    if (visited.has(url) || depth > MAX_DEPTH) continue;
    if (!(await isAllowedByRobots(url))) continue;
    visited.add(url);

    let result = await httpFetch(url);
    if (needsPlaywright(result)) result = await browser.fetchPage(url);
    if (!result.html || result.blocked) continue;

    const $ = cheerio.load(result.html);
    const text = scrapeVisibleText($);
    if (text) {
      chunks.push(`--- ${url} ---\n${text}`);
      totalChars += text.length;
    }

    if (depth < MAX_DEPTH) {
      for (const { href, text } of extractAnchors($, url)) {
        const normalized = normalizeUrl(href);
        if (!visited.has(normalized) && sameDomain(baseUrl, normalized)) {
          queue.push({ url: normalized, depth: depth + 1, priority: getPriority(href, text) });
        }
      }
    }
  }

  return chunks.join("\n\n").slice(0, TOKEN_CHAR_LIMIT);
}

async function runCrawlPhase(
  reportShops: SiteInfo[],
  payload: FlyboxPayload,
  browser: StealthBrowser,
  log: (msg: string) => Promise<void>,
  isCanceled: () => Promise<boolean>,
): Promise<string> {
  await log(`🕷️ Crawling ${reportShops.length} shop site(s) for fishing reports…`);

  const seen = new Set<string>();
  const uniqueSites = reportShops.filter((shop) => {
    try {
      const hostname = new URL(shop.website).hostname;
      if (seen.has(hostname)) return false;
      seen.add(hostname);
      return true;
    } catch {
      return false;
    }
  });

  const siteTexts: Array<{ name: string; text: string }> = [];

  await PromisePool.withConcurrency(3)
    .for(uniqueSites)
    .process(async (shop) => {
      if (await isCanceled()) return;
      await log(`  🔗 Crawling: ${shop.name}`);
      try {
        const text = await crawlSite(shop.website, browser);
        if (text.trim()) siteTexts.push({ name: shop.name, text });
      } catch (err) {
        await log(`  ⚠️ Failed to crawl ${shop.name}: ${String(err)}`);
      }
    });

  if (siteTexts.length === 0) return "No fishing report content found.";

  await log(`🤖 Summarizing ${siteTexts.length} site(s) with Gemini…`);

  const combined = siteTexts
    .map((s) => `==== ${s.name} ====\n${s.text}`)
    .join("\n\n")
    .slice(0, TOKEN_CHAR_LIMIT);

  const ai = new GoogleGenAI({ apiKey: payload.geminiApiKey });
  const prompt = `${payload.summaryPrompt}\n\n${combined}`;

  function parseRetryDelay(err: unknown): number | null {
    const msg = String(err);
    if (!msg.includes("429") && !msg.includes("RESOURCE_EXHAUSTED")) return null;
    const match = msg.match(/"retryDelay"\s*:\s*"(\d+)s"/);
    return match ? Number(match[1]) * 1000 : 60_000;
  }

  async function generateWithRetry(model: string, maxAttempts = 3): Promise<Awaited<ReturnType<typeof ai.models.generateContent>> | null> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await ai.models.generateContent({ model, contents: prompt });
      } catch (err) {
        const retryMs = parseRetryDelay(err);
        if (retryMs !== null && attempt < maxAttempts) {
          const waitSec = Math.ceil(retryMs / 1000);
          await log(`⏳ Gemini rate limit hit — retrying in ${waitSec}s (attempt ${attempt}/${maxAttempts})…`);
          await new Promise((res) => setTimeout(res, retryMs));
          continue;
        }
        const isTransient = String(err).includes("503") || String(err).includes("UNAVAILABLE") || retryMs !== null;
        if (isTransient) return null;
        throw err;
      }
    }
    return null;
  }

  let response = await generateWithRetry(GEMINI_MODEL);

  if (!response) {
    await log(`⚠️ ${GEMINI_MODEL} unavailable — falling back to ${GEMINI_FALLBACK_MODEL}…`);
    response = await generateWithRetry(GEMINI_FALLBACK_MODEL);
    if (!response) {
      await log("⚠️ Gemini quota exhausted — returning raw crawled text without summary.");
      return `[Gemini unavailable — raw crawled text]\n\n${combined}`;
    }
  }

  await log("✅ Summary complete.");
  return response.text ?? "";
}

// ── Pipeline ──────────────────────────────────────────────────────────────────

export async function runFlybox(jobId: string, payload: FlyboxPayload): Promise<void> {
  const job = new JobContext(jobId);
  const browser = new Browser();

  try {
    await browser.launch();

    const allShops = await runShopPhase(
      payload,
      browser,
      (msg) => job.log(msg).then(),
      () => job.isCanceled(),
    );

    if (await job.isCanceled()) return;

    const excel = new ExcelFileHandler();
    for (const shop of allShops) excel.addRow(shop);
    await job.setSecondaryFile(await excel.getBuffer());
    await job.log(`📊 Shop directory saved (${allShops.length} shops).`);

    let reportShops = allShops.filter((s) => s.fishingReport === true);

    if (payload.rivers.length > 0) {
      const riverTerms = payload.rivers.map((r) => r.toLowerCase().trim());
      reportShops = reportShops.filter((s) => {
        const combined = `${s.name} ${s.website} ${s.address}`.toLowerCase();
        return riverTerms.some((r) => combined.includes(r));
      });
      await job.log(`🏞️ Filtered to ${reportShops.length} shop(s) matching rivers: ${payload.rivers.join(", ")}`);
    }

    if (reportShops.length === 0) {
      await job.log("ℹ️ No shops with fishing reports found. Try a broader search.");
      await job.complete();
      return;
    }

    if (await job.isCanceled()) return;

    const summary = await runCrawlPhase(
      reportShops,
      payload,
      browser,
      (msg) => job.log(msg).then(),
      () => job.isCanceled(),
    );

    if (await job.isCanceled()) return;

    const txt = new TXTFileHandler();
    txt.append(summary);
    await job.setPrimaryFile(txt.getBuffer());
    await job.log("📥 Report summary saved.");
    await job.complete();
  } catch (err) {
    await job.fail(String(err));
  } finally {
    await browser.close();
  }
}
