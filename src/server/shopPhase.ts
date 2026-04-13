import { PromisePool } from "@supercharge/promise-pool";
import { getJson } from "serpapi";
import { needsPlaywright, type StealthBrowser } from "@/server/browser";
import { FALLBACK_DETAILS, MESSAGES } from "@/server/constants";
import {
  getContactLink,
  getEmail,
  getSocialMedia,
  hasOnlineShop,
  httpFetch,
  loadHtml,
  publishesFishingReport,
} from "@/server/scrapingUtils";
import type { BasicShop, FlyboxPayload, SiteInfo } from "@/server/types/flybox";

const MAX_RESULTS = 100;
const PAGE_STARTS = [0, 20, 40, 60, 80];
const SCRAPE_CONCURRENCY = 5;

async function fetchShopsPage(
  serpApiKey: string,
  searchTerm: string,
  latitude: number,
  longitude: number,
  start: number,
): Promise<BasicShop[]> {
  try {
    const data = await getJson({
      engine: "google_maps",
      api_key: serpApiKey,
      q: searchTerm,
      ll: `@${latitude},${longitude},14z`,
      type: "search",
      start,
    });

    const results = (data.local_results ?? []) as Record<string, unknown>[];
    return results.map((r) => ({
      name: String(r.title ?? ""),
      website: String(r.website ?? ""),
      address: String(r.address ?? ""),
      phone: String(r.phone ?? ""),
      stars: r.rating !== undefined ? String(r.rating) : MESSAGES.NO_STARS,
      reviews:
        r.reviews !== undefined ? String(r.reviews) : MESSAGES.NO_REVIEWS,
      category: Array.isArray(r.types)
        ? r.types[0]
        : String(r.type ?? MESSAGES.NO_CATEGORY),
    }));
  } catch {
    return [];
  }
}

async function scrapeShop(
  shop: BasicShop,
  browser: StealthBrowser,
  log: (msg: string) => Promise<void>,
): Promise<SiteInfo> {
  if (!shop.website) {
    return { ...shop, ...FALLBACK_DETAILS.NONE };
  }

  let result = await httpFetch(shop.website);

  if (needsPlaywright(result)) {
    await log(`  ↩ Playwright fallback: ${shop.name}`);
    result = await browser.fetchPage(shop.website);
  }

  if (!result.html) return { ...shop, ...FALLBACK_DETAILS.TIMEOUT };
  if (result.blocked)
    return { ...shop, ...FALLBACK_DETAILS.BLOCKED(result.status) };

  try {
    const $ = loadHtml(result.html);
    let email = getEmail($);

    if (!email) {
      const contactUrl = getContactLink($, shop.website);
      if (contactUrl) {
        let contactResult = await httpFetch(contactUrl);
        if (needsPlaywright(contactResult)) {
          contactResult = await browser.fetchPage(contactUrl);
        }
        if (contactResult.html) {
          email = getEmail(loadHtml(contactResult.html));
        }
      }
    }

    return {
      ...shop,
      email: email || MESSAGES.NO_EMAIL,
      sellsOnline: hasOnlineShop($),
      fishingReport: publishesFishingReport($),
      socialMedia: getSocialMedia($),
    };
  } catch {
    return { ...shop, ...FALLBACK_DETAILS.ERROR };
  }
}

export async function runShopPhase(
  payload: FlyboxPayload,
  browser: StealthBrowser,
  log: (msg: string) => Promise<void>,
  isCanceled: () => Promise<boolean>,
): Promise<SiteInfo[]> {
  await log("🔍 Searching for shops via SerpAPI…");

  const pages = await Promise.all(
    PAGE_STARTS.map((start) =>
      fetchShopsPage(
        payload.serpApiKey,
        payload.searchTerm,
        payload.latitude,
        payload.longitude,
        start,
      ),
    ),
  );

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
  const deduped = shops.slice(0, MAX_RESULTS);

  await log(`📋 Found ${deduped.length} shops. Scraping websites…`);

  const results: SiteInfo[] = deduped
    .filter((s) => !s.website)
    .map((s) => ({ ...s, ...FALLBACK_DETAILS.NONE }));

  const withWebsite = deduped.filter((s) => s.website);
  let scraped = 0;

  await PromisePool.withConcurrency(SCRAPE_CONCURRENCY)
    .for(withWebsite)
    .process(async (shop) => {
      if (await isCanceled()) return;
      results.push(await scrapeShop(shop, browser, log));
      scraped++;
      if (scraped % 10 === 0)
        await log(`  … scraped ${scraped}/${withWebsite.length}`);
    });

  await log(
    `✅ Shop phase complete. ${results.filter((s) => s.fishingReport === true).length} shops publish fishing reports.`,
  );
  return results;
}
