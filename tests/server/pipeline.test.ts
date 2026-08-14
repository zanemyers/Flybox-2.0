/* These tests import the real implementations from pipeline.ts. They previously
   kept local COPIES of getRetryDelay, getPriority and the river filter, so
   pipeline.ts had no coverage at all and the copies could drift from the source
   while staying green — which is exactly what happened to getPriority when it
   changed to match on the URL path instead of the whole absolute URL. */
import { describe, expect, it } from "vitest";
import { filterShopsByRivers, getPriority, getRetryDelay } from "@/server/pipeline";

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
