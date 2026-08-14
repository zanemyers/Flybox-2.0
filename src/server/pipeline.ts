import { PromisePool } from "@supercharge/promise-pool";
import * as cheerio from "cheerio";
import { getJson } from "serpapi";
import TinyQueue from "tinyqueue";
import { StealthBrowser as Browser, needsPlaywright, type StealthBrowser } from "@/server/browser";
import type { JobHandler, SiteInfo } from "@/server/handler";
import { extractAnchors, httpFetch, includesAny, isAllowedByRobots, normalizeUrl, sameDomain, scrapeShopDetails, scrapeVisibleText } from "@/server/scraper";

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
      sellsOnline: false,
      fishingReport: false,
      socialMedia: [] as string[],
    }));
  } catch (err) {
    await job.log(`[!!] Failed to fetch results at offset ${start}: ${String(err)}`);
    return [];
  }
}

async function scrapeShop(shop: SiteInfo, browser: StealthBrowser, job: JobHandler): Promise<SiteInfo> {
  if (!shop.website) return shop;

  const { allowed } = await isAllowedByRobots(shop.website);
  if (!allowed) {
    await job.log(`[??] Skipping ${shop.name} — disallowed by robots.txt`);
    return shop;
  }

  let result = await httpFetch(shop.website);
  if (needsPlaywright(result)) {
    await job.log(`[->] Playwright fallback: ${shop.name}`);
    result = await browser.fetchPage(shop.website);
  }

  if (!result.html || result.blocked) return shop;

  try {
    const $ = cheerio.load(result.html);
    const details = await scrapeShopDetails($, shop.website, browser);
    return { ...shop, ...details };
  } catch (err) {
    await job.log(`[!!] Failed to scrape ${shop.name}: ${String(err)}`);
    return shop;
  }
}

async function shopPhase(job: JobHandler, browser: StealthBrowser): Promise<SiteInfo[]> {
  await job.log("[..] Searching for shops via SerpAPI…");

  const pages = await Promise.all([0, 20, 40, 60, 80].map((start) => fetchShopsPage(job, start)));
  const deduped = [...new Map(pages.flat().map((s) => [s.website || s.name, s])).values()].slice(0, 100);
  await job.log(`[..] Found ${deduped.length} shops. Scraping websites…`);

  const results: SiteInfo[] = [];
  let scraped = 0;

  const { errors } = await PromisePool.withConcurrency(10)
    .for(deduped)
    .process(async (shop) => {
      if (await job.isCanceled()) return;
      results.push(await scrapeShop(shop, browser, job));
      scraped++;
      if (scraped % 10 === 0) await job.log(`[->] scraped ${scraped}/${deduped.length}`);
    });

  // PromisePool collects rejections instead of throwing; silently discarding them
  // dropped shops from the spreadsheet with no trace.
  for (const err of errors) {
    await job.log(`[!!] Shop scrape failed for ${err.item?.name ?? "unknown"}: ${String(err)}`);
  }

  await job.log(`[OK] Shop phase complete. ${results.filter((s) => s.fishingReport).length} of ${results.length} shops publish fishing reports.`);
  return results;
}

// ── Report phase ───────────────────────────────────────────────────────────────

const MAX_DEPTH = 20;
const TOKEN_CHAR_LIMIT = 50_000;
const MIN_SITE_CHAR_BUDGET = 4_000;
const MAX_CRAWL_DELAY_SEC = 5;
const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_FALLBACK_MODEL = "gemini-2.5-flash-lite";
const GEMINI_TIMEOUT_MS = 60_000;

const CRAWL_KEYWORDS = ["report", "fishing", "fish", "conditions", "hatch", "fly"];
const CRAWL_JUNK_WORDS = ["/page/", "/tag/", "/category/", "?page=", "wp-admin", "/feed/"];
const CRAWL_CLICK_PHRASES = ["read more", "view report", "see report", "full report", "more info", "learn more"];

/** Path + query of a URL, or the input unchanged if it will not parse. Keyword
    matching must not see the hostname: on flyshop.com every link contains "fly". */
function urlPath(url: string): string {
  try {
    const u = new URL(url);
    return `${u.pathname}${u.search}`;
  } catch {
    return url;
  }
}

export function getPriority(currentUrl: string, href: string, text: string): number {
  const hrefPath = urlPath(href);
  const hasKeyword = includesAny(hrefPath, CRAWL_KEYWORDS);
  const hasJunk = includesAny(hrefPath, CRAWL_JUNK_WORDS);
  const hasClickPhrase = includesAny(text, CRAWL_CLICK_PHRASES);
  const currentHasKeyword = includesAny(urlPath(currentUrl), CRAWL_KEYWORDS);

  if (hasKeyword && !hasJunk) return 0;
  if (currentHasKeyword && hasClickPhrase) return 1;
  if (hasKeyword && hasJunk) return 2;
  return Infinity;
}

async function crawlSite(baseUrl: string, browser: StealthBrowser, charBudget: number, isCanceled: () => Promise<boolean>): Promise<string> {
  const visited = new Set<string>();
  const queue = new TinyQueue<{ url: string; depth: number; priority: number }>(
    [{ url: normalizeUrl(baseUrl), depth: 0, priority: 0 }],
    (a, b) => a.priority - b.priority,
  );
  const chunks: string[] = [];
  let totalChars = 0;

  while (queue.length > 0 && totalChars < charBudget) {
    // Cancellation used to be checked only between whole sites, so a cancelled
    // job kept crawling the site already in flight.
    if (await isCanceled()) break;

    const item = queue.pop();
    if (!item) break;
    const { url, depth } = item;

    if (visited.has(url)) continue;
    visited.add(url);

    const { allowed, crawlDelay } = await isAllowedByRobots(url);
    if (!allowed) continue;
    // Clamped: a site advertising Crawl-delay: 3600 would otherwise stall the job.
    if (crawlDelay > 0) await new Promise((r) => setTimeout(r, Math.min(crawlDelay, MAX_CRAWL_DELAY_SEC) * 1000));

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
      for (const { href, text: linkText } of extractAnchors($, url)) {
        const normalized = normalizeUrl(href);
        const priority = getPriority(url, href, linkText);
        if (!visited.has(normalized) && sameDomain(baseUrl, normalized) && priority < Infinity) {
          queue.push({ url: normalized, depth: depth + 1, priority });
        }
      }
    }
  }

  return chunks.join("\n\n").slice(0, charBudget);
}

function getRetryDelay(err: unknown): number | null {
  const msg = String(err);
  if (msg.includes("503") || msg.includes("UNAVAILABLE")) return 30_000;
  if (!msg.includes("429") && !msg.includes("RESOURCE_EXHAUSTED")) return null;
  const match = msg.match(/"retryDelay"\s*:\s*"(\d+)s"/);
  return match ? Number(match[1]) * 1000 : 30_000;
}

async function summarize(prompt: string, job: JobHandler): Promise<string | null> {
  async function tryModel(model: string): Promise<string | null> {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const res = await Promise.race([
          job.ai.models.generateContent({ model, contents: prompt }),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error("503 Gemini request timed out")), GEMINI_TIMEOUT_MS)),
        ]);
        // An empty body is not a summary. Returning "" counted as success, which
        // skipped the lite-model fallback and shipped an empty report.
        const text = res.text?.trim();
        if (text) return text;
        await job.log(`[!!] Gemini returned an empty response (${model}, attempt ${attempt}/2).`);
      } catch (err) {
        await job.log(`[!!] Gemini error (${model}, attempt ${attempt}/2): ${String(err)}`);
        const retryMs = getRetryDelay(err);
        if (retryMs === null) return null;
        if (attempt < 2) {
          await job.log(`[..] Gemini unavailable — retrying in ${Math.ceil(retryMs / 1000)}s (attempt ${attempt}/2)…`);
          await new Promise((r) => setTimeout(r, retryMs));
        }
      }
    }
    return null;
  }

  const result = await tryModel(GEMINI_MODEL);
  if (result !== null) return result;
  await job.log(`[!!] ${GEMINI_MODEL} unavailable — falling back to ${GEMINI_FALLBACK_MODEL}…`);
  return tryModel(GEMINI_FALLBACK_MODEL);
}

async function reportPhase(reportShops: SiteInfo[], job: JobHandler, browser: StealthBrowser): Promise<string> {
  const uniqueSites = [
    ...new Map(
      reportShops.flatMap((s) => {
        try {
          return [[new URL(s.website).hostname, s] as [string, SiteInfo]];
        } catch {
          return [];
        }
      }),
    ).values(),
  ];

  await job.log(`[..] Crawling ${uniqueSites.length} shop site(s) for fishing reports…`);

  /* Each site gets a share of the prompt budget. Previously every site could
     crawl up to the full 50k limit and the concatenation was then truncated to
     the same 50k, so if the first site filled its budget the rest contributed
     nothing at all — while the log still claimed every site was summarized. */
  const perSiteBudget = Math.max(MIN_SITE_CHAR_BUDGET, Math.floor(TOKEN_CHAR_LIMIT / Math.max(1, uniqueSites.length)));

  const texts: string[] = [];
  const { errors } = await PromisePool.withConcurrency(3)
    .for(uniqueSites)
    .process(async (shop) => {
      if (await job.isCanceled()) return;
      await job.log(`[->] Crawling: ${shop.name}`);
      try {
        const text = await crawlSite(shop.website, browser, perSiteBudget, () => job.isCanceled());
        if (text.trim()) texts.push(`==== ${shop.name} ====\n${text}`);
      } catch (err) {
        await job.log(`[!!] Failed to crawl ${shop.name}: ${String(err)}`);
      }
    });

  for (const err of errors) {
    await job.log(`[!!] Crawl failed for ${err.item?.name ?? "unknown"}: ${String(err)}`);
  }

  if (texts.length === 0) return "No fishing report content found.";

  const combined = texts.join("\n\n").slice(0, TOKEN_CHAR_LIMIT);
  const included = (combined.match(/^==== /gm) ?? []).length;
  if (included < texts.length) {
    await job.log(`[!!] Prompt budget reached — ${included} of ${texts.length} crawled site(s) fit in the summary request.`);
  }

  await job.log(`[..] Summarizing ${included} site(s) with Gemini…`);
  const summary = await summarize(`${job.payload.summaryPrompt}\n\n${combined}`, job);

  if (!summary) {
    await job.log("[!!] Gemini unavailable — returning raw crawled text.");
    return `[Gemini unavailable]\n\n${combined}`;
  }

  await job.log("[OK] Summary complete.");
  return summary;
}

// ── Pipeline ──────────────────────────────────────────────────────────────────

export async function runFlybox(job: JobHandler): Promise<void> {
  const browser = new Browser();

  try {
    await browser.launch();

    const allShops = await shopPhase(job, browser);
    if (await job.isCanceled()) return;

    await job.saveShops(allShops);

    let reportShops = allShops.filter((s) => s.fishingReport);
    if (job.payload.rivers.length > 0) {
      const riverTerms = job.payload.rivers.map((r) => r.toLowerCase().trim());
      reportShops = reportShops.filter((s) => includesAny(`${s.name} ${s.website} ${s.address}`, riverTerms));
      await job.log(`[..] Filtered to ${reportShops.length} shop(s) matching rivers: ${job.payload.rivers.join(", ")}`);
    }

    if (reportShops.length === 0) {
      await job.log("[..] No shops with fishing reports found. Try a broader search.");
      await job.complete();
      return;
    }

    if (await job.isCanceled()) return;

    const summary = await reportPhase(reportShops, job, browser);
    if (await job.isCanceled()) return;

    await job.saveSummary(summary);
    await job.complete();
  } catch (err) {
    // fail() only moves an IN_PROGRESS job, so a cancellation that surfaces as a
    // thrown error is not relabelled FAILED.
    await job.fail(String(err));
  } finally {
    await browser.close();
  }
}
