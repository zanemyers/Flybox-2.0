/* Imports the real implementations: local copies gave pipeline.ts no coverage and drifted from the source while staying green. */
import { describe, expect, it } from "vitest";
import { filterShopsByRivers, getPriority, packSites, paginateShops, SERP_MAX_PAGES, shouldTryFallback } from "@/server/pipeline";
import { normalizeUrl } from "@/server/scraper";

// ── shouldTryFallback ──────────────────────────────────────────────────────────
// The SDK already retried 429s and 5xxs, so the only question left is whether a DIFFERENT model could succeed.

const apiError = (status: number) => Object.assign(new Error(`HTTP ${status}`), { status });

describe("shouldTryFallback", () => {
  it("does not burn a second model on an unusable key", () => {
    expect(shouldTryFallback(apiError(401))).toBe(false);
    expect(shouldTryFallback(apiError(403))).toBe(false);
  });

  it("does not retry a malformed request that would fail identically", () => {
    expect(shouldTryFallback(apiError(400))).toBe(false);
    expect(shouldTryFallback(apiError(422))).toBe(false);
  });

  it("tries the fallback when the model is unavailable to this account", () => {
    expect(shouldTryFallback(apiError(404))).toBe(true);
  });

  it("tries the fallback on rate limit — another model may have headroom", () => {
    expect(shouldTryFallback(apiError(429))).toBe(true);
  });

  it("tries the fallback on any upstream 5xx", () => {
    for (const s of [500, 502, 503, 529]) expect(shouldTryFallback(apiError(s))).toBe(true);
  });

  it("tries the fallback on a connection error or timeout, which carry no status", () => {
    expect(shouldTryFallback(new Error("Connection error."))).toBe(true);
    expect(shouldTryFallback(new Error("Request timed out."))).toBe(true);
  });

  it("handles junk values without throwing", () => {
    for (const v of [null, undefined, "", 0, {}]) expect(typeof shouldTryFallback(v)).toBe("boolean");
  });
});

// ── getPriority ────────────────────────────────────────────────────────────────

describe("getPriority", () => {
  it("returns 0 for a keyword href with no junk", () => {
    expect(getPriority("https://shop.test/", "https://shop.test/fishing-report", "Read")).toBe(0);
  });

  it("returns 0 for a keyword href — junk check is irrelevant when no junk present", () => {
    expect(getPriority("https://shop.test/", "https://shop.test/conditions", "More")).toBe(0);
  });

  it("returns 1 when current URL has keyword and anchor has a click phrase", () => {
    expect(getPriority("https://shop.test/fishing", "https://shop.test/other-page", "Read more")).toBe(1);
  });

  it("returns 2 for a keyword href that also contains junk", () => {
    expect(getPriority("https://shop.test/", "https://shop.test/fishing/page/2", "Next")).toBe(2);
  });

  it("returns Infinity for a href with no keywords and no click phrase context", () => {
    expect(getPriority("https://shop.test/", "https://shop.test/about-us", "About Us")).toBe(Infinity);
  });

  it("priority 0 beats priority 1 — keyword href wins over click-phrase on keyword page", () => {
    expect(getPriority("https://shop.test/fishing", "https://shop.test/report", "Read more")).toBe(0);
  });

  it("returns Infinity when current URL has keyword but anchor text is not a click phrase", () => {
    expect(getPriority("https://shop.test/fishing", "https://shop.test/gallery", "Photo Gallery")).toBe(Infinity);
  });

  // The hostname must not feed the keyword match: on a fly-shop domain every link scored as relevant, leaving no priority order.
  it("ignores keywords in the hostname", () => {
    expect(getPriority("https://flyfishingshop.test/", "https://flyfishingshop.test/about-us", "About Us")).toBe(Infinity);
    expect(getPriority("https://troutfishing.test/", "https://troutfishing.test/shipping", "Shipping")).toBe(Infinity);
  });

  it("still scores the path on a keyword-bearing domain", () => {
    expect(getPriority("https://flyshop.test/", "https://flyshop.test/fishing-report", "Read")).toBe(0);
  });

  it("does not treat a keyword-bearing hostname as keyword context for click phrases", () => {
    expect(getPriority("https://flyshop.test/", "https://flyshop.test/gallery", "Read more")).toBe(Infinity);
  });
});

// ── River filtering ────────────────────────────────────────────────────────────

interface MinShop {
  name: string;
  website: string;
  address: string;
}

const MADISON_SHOP: MinShop = { name: "Madison River Outfitters", website: "https://madisonfly.com", address: "Ennis, MT" };
const UNRELATED_SHOP: MinShop = { name: "Generic Fly Shop", website: "https://genericfly.com", address: "Denver, CO" };

describe("filterShopsByRivers", () => {
  it("keeps shops whose name contains a river term", () => {
    const result = filterShopsByRivers([MADISON_SHOP, UNRELATED_SHOP], ["Madison"]);
    expect(result).toContain(MADISON_SHOP);
    expect(result).not.toContain(UNRELATED_SHOP);
  });

  it("matches via website URL", () => {
    const shop: MinShop = { name: "Flies R Us", website: "https://yellowstoneflies.com", address: "Gardiner, MT" };
    const result = filterShopsByRivers([shop, UNRELATED_SHOP], ["yellowstone"]);
    expect(result).toContain(shop);
    expect(result).not.toContain(UNRELATED_SHOP);
  });

  it("matches via address", () => {
    const shop: MinShop = { name: "Flies R Us", website: "https://randomfly.com", address: "Bozeman, MT near Gallatin River" };
    expect(filterShopsByRivers([shop], ["gallatin"])).toContain(shop);
  });

  it("is case-insensitive", () => {
    expect(filterShopsByRivers([MADISON_SHOP], ["madison"])).toContain(MADISON_SHOP);
  });

  it("trims whitespace from river terms", () => {
    expect(filterShopsByRivers([MADISON_SHOP], ["  madison  "])).toContain(MADISON_SHOP);
  });

  it("returns an empty array when no shops match", () => {
    expect(filterShopsByRivers([UNRELATED_SHOP], ["yellowstone"])).toHaveLength(0);
  });

  it("returns every shop when the river list is empty, rather than dropping them all", () => {
    const result = filterShopsByRivers([MADISON_SHOP, UNRELATED_SHOP], []);
    expect(result).toHaveLength(2);
  });

  it("treats a whitespace-only river term as no filter", () => {
    expect(filterShopsByRivers([MADISON_SHOP, UNRELATED_SHOP], ["   "])).toHaveLength(2);
  });

  it("supports multiple river terms — matches any", () => {
    const result = filterShopsByRivers([MADISON_SHOP, UNRELATED_SHOP], ["madison", "generic"]);
    expect(result).toContain(MADISON_SHOP);
    expect(result).toContain(UNRELATED_SHOP);
  });
});

// ── SerpAPI pagination ─────────────────────────────────────────────────────────
// SerpAPI bills each paginated request separately, so these pin how many searches a run actually costs.

const shop = (name: string): Parameters<typeof filterShopsByRivers>[0][number] & Record<string, unknown> =>
  ({ name, website: `https://${name}.test`, address: "" }) as never;

/** Builds a fake SerpAPI whose pages have the given sizes; null entries fail. */
function fakeSerp(pageSizes: (number | null)[]) {
  const calls: number[] = [];
  const fetchPage = async (start: number) => {
    calls.push(start);
    const size = pageSizes[start / 20];
    if (size === null || size === undefined) return null;
    return Array.from({ length: size }, (_, i) => shop(`s${start}-${i}`));
  };
  return { fetchPage, calls };
}

describe("paginateShops — how many SerpAPI searches a run costs", () => {
  it("spends 1 search when the first page is short", async () => {
    const { fetchPage, calls } = fakeSerp([12]);
    const r = await paginateShops(fetchPage as never);
    expect(r.searchesSpent).toBe(1);
    expect(calls).toEqual([0]);
    expect(r.shops).toHaveLength(12);
  });

  it("spends all 5 only when every page is full", async () => {
    const { fetchPage, calls } = fakeSerp([20, 20, 20, 20, 20]);
    const r = await paginateShops(fetchPage as never);
    expect(r.searchesSpent).toBe(5);
    expect(calls).toEqual([0, 20, 40, 60, 80]);
    expect(r.shops).toHaveLength(100);
    expect(r.stoppedEarly).toBe(false);
  });

  it("stops at the first short page in the middle", async () => {
    const { fetchPage, calls } = fakeSerp([20, 20, 7]);
    const r = await paginateShops(fetchPage as never);
    expect(r.searchesSpent).toBe(3);
    expect(calls).toEqual([0, 20, 40]);
    expect(r.shops).toHaveLength(47);
  });

  it("spends 1 search when the location has no results at all", async () => {
    const { fetchPage } = fakeSerp([0]);
    const r = await paginateShops(fetchPage as never);
    expect(r.searchesSpent).toBe(1);
    expect(r.shops).toHaveLength(0);
  });

  it("never exceeds the page cap", async () => {
    const { fetchPage, calls } = fakeSerp([20, 20, 20, 20, 20, 20, 20]);
    const r = await paginateShops(fetchPage as never);
    expect(calls).toHaveLength(SERP_MAX_PAGES);
    expect(r.searchesSpent).toBe(SERP_MAX_PAGES);
  });

  it("keeps the pages it already paid for when a later request fails", async () => {
    const { fetchPage, calls } = fakeSerp([20, null, 20]);
    const r = await paginateShops(fetchPage as never);
    expect(r.shops).toHaveLength(20);
    expect(r.searchesSpent).toBe(1); // the failed request is not counted
    expect(calls).toEqual([0, 20]); // and it does not push on past the failure
    expect(r.stoppedEarly).toBe(true);
  });

  it("does not mistake a failed first request for an empty location", async () => {
    const { fetchPage } = fakeSerp([null]);
    const r = await paginateShops(fetchPage as never);
    expect(r.shops).toHaveLength(0);
    expect(r.searchesSpent).toBe(0);
    expect(r.stoppedEarly).toBe(true);
  });
});

// ── Crawl targeting, pinned to a real payload ──────────────────────────────────
// Paths and sizes from a real 50,020-char run where a PDF and the privacy policy took 60% of the budget and /news held the reports.

const REAL_BASE = "https://northplatteflyfishing.com/grey-reef";
const link = (path: string, text = "Read more") => getPriority(REAL_BASE, `https://northplatteflyfishing.com${path}`, text);

describe("getPriority — against the pages from a real crawl", () => {
  it("crawls the report archive even though /news has no fishing word", () => {
    expect(link("/news")).toBeLessThan(Infinity);
    for (const p of ["/blog", "/fishing-report", "/river-conditions", "/journal", "/updates"]) {
      expect(link(p)).toBeLessThan(Infinity);
    }
  });

  it("excludes the PDF that was 39% of the real payload", () => {
    expect(link("/wp-content/uploads/2021/09/PATHFINDER_INFOSHEET.pdf")).toBe(Infinity);
  });

  it("excludes the privacy policy that was 20% of the real payload", () => {
    expect(link("/privacy-policy")).toBe(Infinity);
  });

  it("excludes other binaries and boilerplate regardless of keywords in the name", () => {
    for (const p of ["/fishing-report.pdf", "/fly-photo.jpg", "/river-map.zip", "/terms-of-service", "/cart", "/checkout", "/my-account"]) {
      expect(link(p)).toBe(Infinity);
    }
  });

  it("still ignores keywords that appear only in the hostname", () => {
    expect(getPriority("https://flyfishingshop.test/", "https://flyfishingshop.test/about-us", "About")).toBe(Infinity);
  });
});

describe("normalizeUrl — tracking parameters", () => {
  it("dedupes the utm variant against the clean URL", () => {
    const utm = normalizeUrl("https://northplatteflyfishing.com/grey-reef/?utm_source=local&utm_medium=organic&utm_campaign=grey_reef&utm_id=GMB");
    expect(utm).toBe(normalizeUrl("https://northplatteflyfishing.com/grey-reef"));
  });

  it("keeps parameters that actually select content", () => {
    expect(normalizeUrl("https://shop.test/reports?year=2026")).toContain("year=2026");
  });

  it("strips the common ad-click ids too", () => {
    expect(normalizeUrl("https://shop.test/news?fbclid=abc&gclid=def")).toBe("https://shop.test/news");
  });
});

// ── packSites ──────────────────────────────────────────────────────────────────

// perSiteBudget is floored at 4,000, so past a dozen sites the shares exceed the total.
describe("packSites", () => {
  const site = (name: string, chars: number) => `==== ${name} ====\n${"x".repeat(chars)}`;

  it("keeps everything when it all fits", () => {
    const texts = [site("A", 100), site("B", 100)];
    const { combined, included, cutShort } = packSites(texts, 10_000);
    expect(included).toBe(2);
    expect(cutShort).toBe(false);
    expect(combined).toBe(texts.join("\n\n"));
  });

  it("stops at the last whole site that fits, and says how many", () => {
    const texts = [site("A", 400), site("B", 400), site("C", 400)];
    const { included, cutShort } = packSites(texts, 900);
    expect(included).toBe(2);
    expect(cutShort).toBe(false);
  });

  it("never emits a partial site block when a whole one was possible", () => {
    const texts = [site("A", 400), site("B", 400), site("C", 400)];
    const { combined, included } = packSites(texts, 900);
    // One header per included site, and no orphaned header from the site that was dropped.
    expect((combined.match(/^==== /gm) ?? []).length).toBe(included);
    expect(combined).not.toContain("==== C ====");
  });

  it("stays inside the budget", () => {
    const texts = [site("A", 400), site("B", 400), site("C", 400)];
    expect(packSites(texts, 900).combined.length).toBeLessThanOrEqual(900);
  });

  it("counts the join between blocks, so two that only fit unseparated do not both go in", () => {
    const texts = ["a".repeat(50), "b".repeat(50)];
    // 50 + 2 + 50 = 102, one over.
    expect(packSites(texts, 101).included).toBe(1);
    expect(packSites(texts, 102).included).toBe(2);
  });

  /* The case the old header count could not express: one site bigger than the whole budget. */
  it("cuts a single oversized site short rather than returning nothing", () => {
    const { combined, included, cutShort } = packSites([site("A", 5_000)], 1_000);
    expect(cutShort).toBe(true);
    expect(included).toBe(1);
    expect(combined.length).toBe(1_000);
    expect(combined).toContain("==== A ====");
  });

  it("reports a cut-short first site even when others were dropped behind it", () => {
    const { included, cutShort } = packSites([site("A", 5_000), site("B", 100)], 1_000);
    expect(cutShort).toBe(true);
    expect(included).toBe(1); // so the caller sees 1 of 2 and warns
  });

  it("has nothing to say about no sites", () => {
    expect(packSites([], 1_000)).toEqual({ combined: "", included: 0, cutShort: false });
  });
});
