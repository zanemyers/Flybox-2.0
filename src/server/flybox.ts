import { GoogleGenAI } from "@google/genai";
import { PromisePool } from "@supercharge/promise-pool";
import * as cheerio from "cheerio";
import { getJson } from "serpapi";
import TinyQueue from "tinyqueue";
import { StealthBrowser as Browser, needsPlaywright, type StealthBrowser } from "@/server/browser";
import { JobHandler, type SiteInfo } from "@/server/handlers";
import { extractAnchors, httpFetch, includesAny, isAllowedByRobots, normalizeUrl, sameDomain, scrapeShopDetails, scrapeVisibleText } from "@/server/scrapingUtils";

const BLANK: Pick<SiteInfo, "email" | "sellsOnline" | "fishingReport" | "socialMedia"> = { email: "", sellsOnline: "", fishingReport: "", socialMedia: [] };

// ── Shop phase ────────────────────────────────────────────────────────────────
async function fetchShopsPage(job: JobHandler, start: number): Promise<SiteInfo[]> {
  try {
    const { serpApiKey, searchTerm, latitude, longitude } = job.payload;
    const data = await getJson({ engine: "google_maps", api_key: serpApiKey, q: searchTerm, ll: `@${latitude},${longitude},8z`, type: "search", start });
    return ((data.local_results ?? []) as Record<string, unknown>[]).map((r) => ({
      name: String(r.title ?? ""),
      website: String(r.website ?? ""),
      address: String(r.address ?? ""),
      phone: String(r.phone ?? ""),
      stars: String(r.rating ?? ""),
      reviews: String(r.reviews ?? ""),
      category: Array.isArray(r.types) ? r.types[0] : String(r.type ?? ""),
      email: "",
      sellsOnline: "",
      fishingReport: "",
      socialMedia: [] as string[],
    }));
  } catch (err) {
    await job.log(`  ⚠️ Failed to fetch results at offset ${start}: ${String(err)}`);
    return [];
  }
}

async function scrapeShop(shop: SiteInfo, browser: StealthBrowser, job: JobHandler): Promise<SiteInfo> {
  if (!shop.website) return shop;

  if (!(await isAllowedByRobots(shop.website))) {
    await job.log(`  🤖 Skipping ${shop.name} — disallowed by robots.txt`);
    return shop;
  }

  let result = await httpFetch(shop.website);
  if (needsPlaywright(result)) {
    await job.log(`  ↩ Playwright fallback: ${shop.name}`);
    result = await browser.fetchPage(shop.website);
  }

  if (!result.html) return { ...shop, ...BLANK };
  if (result.blocked) return { ...shop, ...BLANK };

  try {
    const $ = cheerio.load(result.html);
    const details = await scrapeShopDetails($, shop.website, browser);
    return { ...shop, ...details };
  } catch {
    return { ...shop, ...BLANK };
  }
}

async function shopPhase(job: JobHandler, browser: StealthBrowser): Promise<SiteInfo[]> {
  await job.log("🔍 Searching for shops via SerpAPI…");

  const pages = await Promise.all([0, 20, 40, 60, 80].map((start) => fetchShopsPage(job, start)));
  const deduped = [...new Map(pages.flat().map((s) => [s.website || s.name, s])).values()].slice(0, 100);
  await job.log(`📋 Found ${deduped.length} shops. Scraping websites…`);

  const results: SiteInfo[] = [];
  let scraped = 0;

  await PromisePool.withConcurrency(10)
    .for(deduped)
    .process(async (shop) => {
      if (await job.isCanceled()) return;
      results.push(await scrapeShop(shop, browser, job));
      scraped++;
      if (scraped % 10 === 0) await job.log(`  … scraped ${scraped}/${deduped.length}`);
    });

  await job.log(`✅ Shop phase complete. ${results.filter((s) => s.fishingReport === "✅").length} shops publish fishing reports.`);
  return results;
}

// ── Crawl phase ───────────────────────────────────────────────────────────────

const MAX_DEPTH = 20;
const TOKEN_CHAR_LIMIT = 200_000;
const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_FALLBACK_MODEL = "gemini-2.0-flash";

const CRAWL_KEYWORDS = ["report", "fishing", "fish", "conditions", "hatch", "fly"];
const CRAWL_JUNK_WORDS = ["/page/", "/tag/", "/category/", "?page=", "wp-admin", "/feed/"];
const CRAWL_CLICK_PHRASES = ["read more", "view report", "see report", "full report", "more info", "learn more"];

function getPriority(currentUrl: string, href: string, text: string): number {
  const hasKeyword = includesAny(href, CRAWL_KEYWORDS);
  const hasJunk = includesAny(href, CRAWL_JUNK_WORDS);
  const hasClickPhrase = includesAny(text, CRAWL_CLICK_PHRASES);
  const currentHasKeyword = includesAny(currentUrl, CRAWL_KEYWORDS);

  if (hasKeyword && !hasJunk) return 0;
  if (currentHasKeyword && hasClickPhrase) return 1;
  if (hasKeyword && hasJunk) return 2;
  return Infinity;
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
        const priority = getPriority(url, href, text);
        if (!visited.has(normalized) && sameDomain(baseUrl, normalized) && priority < Infinity) {
          queue.push({ url: normalized, depth: depth + 1, priority });
        }
      }
    }
  }

  return chunks.join("\n\n").slice(0, TOKEN_CHAR_LIMIT);
}

async function reportPhase(reportShops: SiteInfo[], job: JobHandler, browser: StealthBrowser): Promise<string> {
  await job.log(`🕷️ Crawling ${reportShops.length} shop site(s) for fishing reports…`);

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
      if (await job.isCanceled()) return;
      await job.log(`  🔗 Crawling: ${shop.name}`);
      try {
        const text = await crawlSite(shop.website, browser);
        if (text.trim()) siteTexts.push({ name: shop.name, text });
      } catch (err) {
        await job.log(`  ⚠️ Failed to crawl ${shop.name}: ${String(err)}`);
      }
    });

  if (siteTexts.length === 0) return "No fishing report content found.";

  await job.log(`🤖 Summarizing ${siteTexts.length} site(s) with Gemini…`);

  const combined = siteTexts
    .map((s) => `==== ${s.name} ====\n${s.text}`)
    .join("\n\n")
    .slice(0, TOKEN_CHAR_LIMIT);

  const ai = new GoogleGenAI({ apiKey: job.payload.geminiApiKey });
  const prompt = `${job.payload.summaryPrompt}\n\n${combined}`;

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
          await job.log(`⏳ Gemini rate limit hit — retrying in ${waitSec}s (attempt ${attempt}/${maxAttempts})…`);
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
    await job.log(`⚠️ ${GEMINI_MODEL} unavailable — falling back to ${GEMINI_FALLBACK_MODEL}…`);
    response = await generateWithRetry(GEMINI_FALLBACK_MODEL);
    if (!response) {
      await job.log("⚠️ Gemini quota exhausted — returning raw crawled text without summary.");
      return `[Gemini unavailable — raw crawled text]\n\n${combined}`;
    }
  }

  await job.log("✅ Summary complete.");
  return response.text ?? "";
}

// ── Pipeline ──────────────────────────────────────────────────────────────────

export async function runFlybox(job: JobHandler): Promise<void> {
  const browser = new Browser();

  try {
    await browser.launch();

    const allShops = await shopPhase(job, browser);

    if (await job.isCanceled()) return;

    for (const shop of allShops) job.xls.addRow(shop);
    await job.setSecondaryFile(await job.xls.getBuffer());
    await job.log(`📊 Shop directory saved (${allShops.length} shops).`);

    let reportShops = allShops.filter((s) => s.fishingReport === "✅");

    if (job.payload.rivers.length > 0) {
      const riverTerms = job.payload.rivers.map((r) => r.toLowerCase().trim());
      reportShops = reportShops.filter((s) => {
        const combined = `${s.name} ${s.website} ${s.address}`.toLowerCase();
        return riverTerms.some((r) => combined.includes(r));
      });
      await job.log(`🏞️ Filtered to ${reportShops.length} shop(s) matching rivers: ${job.payload.rivers.join(", ")}`);
    }

    if (reportShops.length === 0) {
      await job.log("ℹ️ No shops with fishing reports found. Try a broader search.");
      await job.complete();
      return;
    }

    if (await job.isCanceled()) return;

    const summary = await reportPhase(reportShops, job, browser);

    if (await job.isCanceled()) return;

    job.txt.append(summary);
    await job.setPrimaryFile(job.txt.getBuffer());
    await job.log("📥 Report summary saved.");
    await job.complete();
  } catch (err) {
    await job.fail(String(err));
  } finally {
    await browser.close();
  }
}
