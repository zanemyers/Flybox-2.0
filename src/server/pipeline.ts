import { PromisePool } from "@supercharge/promise-pool";
import * as cheerio from "cheerio";
import { getJson } from "serpapi";
import TinyQueue from "tinyqueue";
import { StealthBrowser as Browser, needsPlaywright, type StealthBrowser } from "@/server/browser";
import { requireKey, SEARCH_TERM, SUMMARY_PROMPT } from "@/server/config";
import type { JobHandler, SiteInfo } from "@/server/handler";
import { extractAnchors, httpFetch, includesAny, isAllowedByRobots, normalizeUrl, sameDomain, scrapeShopDetails, scrapeVisibleText } from "@/server/scraper";

// ── Shop phase ────────────────────────────────────────────────────────────────

/* SerpAPI bills every paginated request separately and its google_maps engine
   returns at most 20 results per page — there is no `num` parameter to raise
   that, so 100 listings genuinely costs 5 searches. The only lever is to stop
   asking for pages that do not exist: a page shorter than SERP_PAGE_SIZE is the
   last one. A rural search returning 12 shops used to burn all 5 searches, four
   of them on empty pages. */
export const SERP_PAGE_SIZE = 20;
export const SERP_MAX_PAGES = 5;

/** Walks SerpAPI pages until one comes back short. `fetchPage` returns null to
    mean "the request failed", which is NOT the same as "there are no more
    results" — on failure we stop rather than assume the listing ended. */
export async function paginateShops(
  fetchPage: (start: number) => Promise<SiteInfo[] | null>,
  maxPages = SERP_MAX_PAGES,
  pageSize = SERP_PAGE_SIZE,
): Promise<{ shops: SiteInfo[]; searchesSpent: number; stoppedEarly: boolean }> {
  const shops: SiteInfo[] = [];
  let searchesSpent = 0;

  for (let page = 0; page < maxPages; page++) {
    const batch = await fetchPage(page * pageSize);
    if (batch === null) return { shops, searchesSpent, stoppedEarly: true };

    searchesSpent++;
    shops.push(...batch);
    if (batch.length < pageSize) return { shops, searchesSpent, stoppedEarly: true };
  }

  return { shops, searchesSpent, stoppedEarly: false };
}

async function fetchShopsPage(job: JobHandler, start: number): Promise<SiteInfo[] | null> {
  try {
    const { latitude, longitude } = job.payload;
    const data = await getJson({
      engine: "google_maps",
      api_key: requireKey("SERP_API_KEY"),
      q: SEARCH_TERM,
      ll: `@${latitude},${longitude},8z`,
      type: "search",
      start,
    });
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
    return null;
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

  // A site the address guard declined otherwise looks identical to one that simply failed.
  if (result.refused) {
    await job.log(`[??] Skipping ${shop.name} — ${result.error}`);
    return shop;
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

  const { shops, searchesSpent } = await paginateShops((start) => fetchShopsPage(job, start));
  const deduped = [...new Map(shops.map((s) => [s.website || s.name, s])).values()];
  await job.log(`[..] Found ${deduped.length} shops using ${searchesSpent} of ${SERP_MAX_PAGES} SerpAPI searches. Scraping websites…`);

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
/* Raw mode has no prompt, so the only bound is a sane download size. */
const RAW_CHAR_LIMIT = 500_000;
const MIN_SITE_CHAR_BUDGET = 4_000;
const MAX_CRAWL_DELAY_SEC = 5;
/* Luna is the cheap tier and this is structured extraction, not reasoning, so
   reasoning effort is pinned OFF — reasoning tokens bill at the output rate and
   the family defaults to a non-zero effort. Terra is the escape hatch: it only
   runs if Luna has already failed every SDK retry, and it costs ~10x, so it must
   never become the default path. */
const OPENAI_MODEL = "gpt-5.6-luna";
const OPENAI_FALLBACK_MODEL = "gpt-5.6-terra";
const OPENAI_REASONING_EFFORT = "none" as const;

/* Output is the majority of the per-call cost, and an unbounded digest on a
   pathological run is the one way this gets expensive. */
const MAX_OUTPUT_TOKENS = 6_000;

/* Report content is not always filed under a fishing word. On a real crawl of
   northplatteflyfishing.com the reports lived at /news, so matching only
   fishing vocabulary skipped the one page that mattered. The section words
   below are what shops actually use for their report archives. */
const CRAWL_KEYWORDS = ["report", "fishing", "fish", "conditions", "hatch", "fly", "river", "stream", "creek", "water", "news", "blog", "journal", "update"];
const CRAWL_JUNK_WORDS = ["/page/", "/tag/", "/category/", "?page=", "wp-admin", "/feed/"];
const CRAWL_CLICK_PHRASES = ["read more", "view report", "see report", "full report", "more info", "learn more"];

/* Paths that never carry a fishing report however the site is organized. The
   privacy policy alone was 20% of one real 50,000-char payload. */
const CRAWL_EXCLUDE = [
  "privacy",
  "terms",
  "policy",
  "legal",
  "disclaimer",
  "cart",
  "checkout",
  "account",
  "login",
  "register",
  "wp-content",
  "wp-json",
  "returns",
  "shipping",
  "gift-card",
];

/* Non-HTML assets. A PDF fetched and handed to cheerio comes back as binary
   noise: one real payload was 39% a single PATHFINDER_INFOSHEET.pdf, complete
   with %PDF/endstream/endobj markers. */
const BINARY_EXT = /\.(pdf|docx?|xlsx?|pptx?|zip|rar|gz|tar|jpe?g|png|gif|webp|svg|ico|mp4|mp3|wav|avi|mov|css|js)$/i;

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

/** Pathname alone, with no query — for extension tests. */
function urlPathname(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

export function getPriority(currentUrl: string, href: string, text: string): number {
  const hrefPath = urlPath(href);

  // Cheap, absolute exclusions first — these are never worth a fetch.
  if (BINARY_EXT.test(urlPathname(href))) return Infinity;
  if (includesAny(hrefPath, CRAWL_EXCLUDE)) return Infinity;

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
    // Cancellation used to be checked only between whole sites, so a canceled
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
      /* Add whole pages only. Slicing the joined result cut the last page off
         mid-sentence, which is worse than simply not including it. If even the
         first page overflows we keep a word-boundary-trimmed prefix, because
         some content beats none. */
      const chunk = `--- ${url} ---\n${text}`;
      if (totalChars + chunk.length <= charBudget) {
        chunks.push(chunk);
        totalChars += chunk.length;
      } else if (chunks.length === 0) {
        const room = charBudget - `--- ${url} ---\n`.length;
        const cut = text.slice(0, Math.max(0, room));
        chunks.push(`--- ${url} ---\n${cut.slice(0, cut.lastIndexOf(" ") + 1 || cut.length).trimEnd()}`);
        break;
      } else {
        break;
      }
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

  return chunks.join("\n\n");
}

/* The SDK already retried 429s and 5xxs with backoff before throwing, so by the
   time an error reaches us the question is only whether a DIFFERENT model could
   succeed. It could not for auth, quota, or a malformed request — those fail the
   same way on every model, and retrying just wastes time and money. */
export function shouldTryFallback(err: unknown): boolean {
  const status = (err as { status?: number })?.status;
  if (typeof status === "number") {
    if (status === 401 || status === 403) return false; // bad or unauthorized key
    if (status === 400 || status === 422) return false; // malformed request
    if (status === 404) return true; // model not available to this account
    if (status === 429) return true; // rate/quota — a different model may have room
    return status >= 500; // transient upstream
  }
  // No status: a connection error or an aborted timeout. Worth one other attempt.
  return true;
}

async function summarize(prompt: string, job: JobHandler): Promise<string | null> {
  async function tryModel(model: string): Promise<{ text: string | null; err: unknown }> {
    try {
      const res = await job.ai.responses.create({
        model,
        input: prompt,
        max_output_tokens: MAX_OUTPUT_TOKENS,
        reasoning: { effort: OPENAI_REASONING_EFFORT },
      });

      if (res.status === "incomplete" && res.incomplete_details?.reason === "max_output_tokens") {
        await job.log(`[!!] ${model} hit the ${MAX_OUTPUT_TOKENS}-token output cap; the summary may be truncated.`);
      }

      // An empty body is not a summary — returning "" would skip the fallback.
      const text = res.output_text?.trim();
      if (text) return { text, err: null };
      await job.log(`[!!] ${model} returned an empty response.`);
      return { text: null, err: null };
    } catch (err) {
      await job.log(`[!!] ${model} failed: ${String(err)}`);
      return { text: null, err };
    }
  }

  const primary = await tryModel(OPENAI_MODEL);
  if (primary.text) return primary.text;
  if (primary.err !== null && !shouldTryFallback(primary.err)) return null;

  await job.log(`[..] Falling back to ${OPENAI_FALLBACK_MODEL}…`);
  return (await tryModel(OPENAI_FALLBACK_MODEL)).text;
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

  const { summarize: wantsSummary } = job.payload;
  await job.log(`[..] Crawling ${uniqueSites.length} shop site(s) for fishing reports…`);

  /* Each site gets a share of the budget. Previously every site could crawl up
     to the full limit and the concatenation was then truncated to the same
     limit, so if the first site filled its budget the rest contributed nothing.
     Raw mode has no prompt to fit, so it gets a far larger allowance. */
  const totalBudget = wantsSummary ? TOKEN_CHAR_LIMIT : RAW_CHAR_LIMIT;
  const perSiteBudget = Math.max(MIN_SITE_CHAR_BUDGET, Math.floor(totalBudget / Math.max(1, uniqueSites.length)));

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

  const { combined, included, cutShort } = packSites(texts, totalBudget);

  if (included < texts.length) {
    await job.log(`[!!] Budget reached — ${included} of ${texts.length} crawled site(s) fit in the output${cutShort ? ", and that one is cut short" : ""}.`);
  } else if (cutShort) {
    await job.log("[!!] Budget reached — the crawled site is cut short in the output.");
  }

  // Only when summarizing: in raw mode this text IS the report, and storing it twice cost a second copy of up to 500 KB.
  if (wantsSummary) await job.saveRawText(combined);

  // Raw mode: hand back what was crawled and never call the model at all.
  if (!wantsSummary) {
    await job.log(`[OK] Raw text from ${included} site(s) ready — summarization skipped.`);
    return combined;
  }

  await job.log(`[..] Summarizing ${included} site(s) with ${OPENAI_MODEL}…`);
  const summary = await summarize(`${SUMMARY_PROMPT}\n\n${combined}`, job);

  if (!summary) {
    await job.log("[!!] Summarization unavailable — returning raw crawled text.");
    return `[Summarization unavailable]\n\n${combined}`;
  }

  await job.log("[OK] Summary complete.");
  return summary;
}

/** Fits whole site blocks into a character budget, in order, and says what it left out.
    `cutShort` is the one case a whole block cannot be kept: a single site larger than the budget. */
export function packSites(texts: string[], budget: number): { combined: string; included: number; cutShort: boolean } {
  const blocks: string[] = [];
  let used = 0;

  for (const text of texts) {
    const cost = (blocks.length > 0 ? 2 : 0) + text.length; // 2 for the "\n\n" join
    if (used + cost > budget) break;
    blocks.push(text);
    used += cost;
  }

  if (blocks.length > 0) return { combined: blocks.join("\n\n"), included: blocks.length, cutShort: false };
  if (texts.length === 0) return { combined: "", included: 0, cutShort: false };
  return { combined: texts[0].slice(0, budget), included: 1, cutShort: true };
}

/** Keeps shops whose name, website or address mentions one of the river terms.
    Callers must skip this when `rivers` is empty — an empty term list matches
    nothing, which would drop every shop rather than disabling the filter. */
export function filterShopsByRivers<T extends Pick<SiteInfo, "name" | "website" | "address">>(shops: T[], rivers: string[]): T[] {
  const riverTerms = rivers.map((r) => r.toLowerCase().trim()).filter(Boolean);
  if (riverTerms.length === 0) return shops;
  return shops.filter((s) => includesAny(`${s.name} ${s.website} ${s.address}`, riverTerms));
}

// ── Pipeline ──────────────────────────────────────────────────────────────────

export async function runFlybox(job: JobHandler): Promise<void> {
  const browser = new Browser();

  try {
    await browser.launch();

    /* Started, not awaited: naming the coordinates took up to 5s off the front of the POST when the route did it, and
       the catalog does not need the label until the run is listed. Awaited after the phase it overlaps, which is minutes. */
    const naming = job.resolveLocationName();

    const allShops = await shopPhase(job, browser);
    await naming;
    if (await job.isCanceled()) return;

    // The phase above still had to run: the report phase filters on the fishingReport flags it sets.
    if (job.payload.shopDirectory) await job.saveShops(allShops);
    else await job.log("[..] Shop directory not requested — skipping the workbook.");

    let reportShops = allShops.filter((s) => s.fishingReport);
    if (job.payload.rivers.length > 0) {
      reportShops = filterShopsByRivers(reportShops, job.payload.rivers);
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
    // thrown error is not relabeled FAILED.
    await job.fail(String(err));
  } finally {
    await browser.close();
  }
}
