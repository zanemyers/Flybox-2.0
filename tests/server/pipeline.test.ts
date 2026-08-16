/* These tests import the real implementations from pipeline.ts. They previously
   kept local COPIES of getRetryDelay, getPriority and the river filter, so
   pipeline.ts had no coverage at all and the copies could drift from the source
   while staying green — which is exactly what happened to getPriority when it
   changed to match on the URL path instead of the whole absolute URL. */
import { describe, expect, it } from "vitest";
import { filterShopsByRivers, getPriority, getRetryDelay, paginateShops, SERP_MAX_PAGES } from "@/server/pipeline";
import { normalizeUrl } from "@/server/scraper";

// ── getRetryDelay ──────────────────────────────────────────────────────────────

describe("getRetryDelay", () => {
  it("returns 30s for a 503 error", () => {
    expect(getRetryDelay(new Error("503 Service Unavailable"))).toBe(30_000);
  });

  it("returns 30s for UNAVAILABLE gRPC status", () => {
    expect(getRetryDelay(new Error("14 UNAVAILABLE: upstream connect error"))).toBe(30_000);
  });

  it("returns 30s for a 503 in a string message", () => {
    expect(getRetryDelay("Error: 503 Gemini request timed out")).toBe(30_000);
  });

  it("returns 30s for 429 without a retryDelay field", () => {
    expect(getRetryDelay(new Error("429 Too Many Requests"))).toBe(30_000);
  });

  it("returns 30s for RESOURCE_EXHAUSTED without a retryDelay field", () => {
    expect(getRetryDelay(new Error("RESOURCE_EXHAUSTED quota exceeded"))).toBe(30_000);
  });

  it("extracts retryDelay seconds from a 429 error payload", () => {
    const err = new Error('429 RESOURCE_EXHAUSTED: {"retryDelay": "45s", "message": "quota"}');
    expect(getRetryDelay(err)).toBe(45_000);
  });

  it("extracts retryDelay with varying whitespace", () => {
    const err = new Error('429 error {"retryDelay"  :  "120s"}');
    expect(getRetryDelay(err)).toBe(120_000);
  });

  it("returns null for a generic non-retryable error", () => {
    expect(getRetryDelay(new Error("TypeError: Cannot read properties of undefined"))).toBeNull();
  });

  it("returns null for a network error unrelated to rate limiting", () => {
    expect(getRetryDelay(new Error("ECONNREFUSED"))).toBeNull();
  });

  it("returns null for an empty error message", () => {
    expect(getRetryDelay(new Error(""))).toBeNull();
  });

  it("handles a plain string error", () => {
    expect(getRetryDelay("503 error")).toBe(30_000);
  });

  it("handles a null-ish value gracefully", () => {
    expect(getRetryDelay(null)).toBeNull();
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

  // The hostname must not feed the keyword match: on a fly-shop domain, every
  // single link used to score as relevant, so the crawler had no priority order.
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
// SerpAPI bills each paginated request separately, so these tests pin how many
// searches a run actually costs. Getting this wrong costs real money.

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
// These paths and sizes come from an actual 50,020-char run against
// northplatteflyfishing.com, where a PDF and the privacy policy consumed 60% of
// the budget and the reports at /news were the content that mattered.

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
