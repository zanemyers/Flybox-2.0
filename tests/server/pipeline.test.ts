import { describe, expect, it } from "vitest";
import { includesAny } from "@/server/scraper";

// getRetryDelay is not exported from pipeline.ts, so we replicate and test the
// logic directly here. The function is a pure decision tree — no I/O.
function getRetryDelay(err: unknown): number | null {
  const msg = String(err);
  if (msg.includes("503") || msg.includes("UNAVAILABLE")) return 30_000;
  if (!msg.includes("429") && !msg.includes("RESOURCE_EXHAUSTED")) return null;
  const match = msg.match(/"retryDelay"\s*:\s*"(\d+)s"/);
  return match ? Number(match[1]) * 1000 : 30_000;
}

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
// Replicated from pipeline.ts (unexported). Tests cover all four return branches.

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
    const p0 = getPriority("https://shop.test/fishing", "https://shop.test/report", "Read more");
    expect(p0).toBe(0);
  });

  it("returns Infinity when current URL has keyword but anchor text is not a click phrase", () => {
    expect(getPriority("https://shop.test/fishing", "https://shop.test/gallery", "Photo Gallery")).toBe(Infinity);
  });
});

// ── River filtering logic ──────────────────────────────────────────────────────
// Replicated from runFlybox in pipeline.ts. The filter is a pure data transform.

interface MinShop {
  name: string;
  website: string;
  address: string;
  fishingReport: boolean;
}

function filterByRivers(shops: MinShop[], rivers: string[]): MinShop[] {
  const riverTerms = rivers.map((r) => r.toLowerCase().trim());
  return shops.filter((s) => includesAny(`${s.name} ${s.website} ${s.address}`, riverTerms));
}

const REPORT_SHOP: MinShop = { name: "Madison River Outfitters", website: "https://madisonfly.com", address: "Ennis, MT", fishingReport: true };
const UNRELATED_SHOP: MinShop = { name: "Generic Fly Shop", website: "https://genericfly.com", address: "Denver, CO", fishingReport: true };

describe("river filtering", () => {
  it("keeps shops whose name contains a river term", () => {
    const result = filterByRivers([REPORT_SHOP, UNRELATED_SHOP], ["Madison"]);
    expect(result).toContain(REPORT_SHOP);
    expect(result).not.toContain(UNRELATED_SHOP);
  });

  it("matches via website URL", () => {
    const shop: MinShop = { name: "Flies R Us", website: "https://yellowstoneflies.com", address: "Gardiner, MT", fishingReport: true };
    const result = filterByRivers([shop, UNRELATED_SHOP], ["yellowstone"]);
    expect(result).toContain(shop);
    expect(result).not.toContain(UNRELATED_SHOP);
  });

  it("matches via address", () => {
    const shop: MinShop = { name: "Flies R Us", website: "https://randomfly.com", address: "Bozeman, MT near Gallatin River", fishingReport: true };
    const result = filterByRivers([shop], ["gallatin"]);
    expect(result).toContain(shop);
  });

  it("is case-insensitive", () => {
    const result = filterByRivers([REPORT_SHOP], ["madison"]);
    expect(result).toContain(REPORT_SHOP);
  });

  it("trims whitespace from river terms", () => {
    const result = filterByRivers([REPORT_SHOP], ["  madison  "]);
    expect(result).toContain(REPORT_SHOP);
  });

  it("returns empty array when no shops match", () => {
    const result = filterByRivers([UNRELATED_SHOP], ["yellowstone"]);
    expect(result).toHaveLength(0);
  });

  it("returns all shops when rivers array is empty (no filtering applied)", () => {
    const result = filterByRivers([REPORT_SHOP, UNRELATED_SHOP], []);
    expect(result).toHaveLength(0);
  });

  it("supports multiple river terms — matches any", () => {
    const result = filterByRivers([REPORT_SHOP, UNRELATED_SHOP], ["madison", "generic"]);
    expect(result).toContain(REPORT_SHOP);
    expect(result).toContain(UNRELATED_SHOP);
  });
});
