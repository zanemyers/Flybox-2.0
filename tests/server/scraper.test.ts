import * as cheerio from "cheerio";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StealthBrowser } from "@/server/browser";
import { extractAnchors, includesAny, isAllowedByRobots, normalizeUrl, sameDomain, scrapeShopDetails, scrapeVisibleText } from "@/server/scraper";

// ── includesAny ────────────────────────────────────────────────────────────────

describe("includesAny", () => {
  it("returns true when any term matches (case-insensitive)", () => {
    expect(includesAny("Fishing Report for June", ["fishing report", "conditions"])).toBe(true);
  });

  it("returns true on partial match", () => {
    expect(includesAny("/fishing-report-2024", ["report"])).toBe(true);
  });

  it("returns false when no terms match", () => {
    expect(includesAny("Contact Us | Shop", ["report", "conditions", "hatch"])).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(includesAny("HATCH REPORT", ["hatch report"])).toBe(true);
  });

  it("returns false for empty terms array", () => {
    expect(includesAny("anything", [])).toBe(false);
  });

  it("returns false for empty target string", () => {
    expect(includesAny("", ["report"])).toBe(false);
  });
});

// ── normalizeUrl ───────────────────────────────────────────────────────────────

describe("normalizeUrl", () => {
  it("removes trailing slash", () => {
    expect(normalizeUrl("https://example.com/")).toBe("https://example.com");
  });

  it("removes hash fragment", () => {
    expect(normalizeUrl("https://example.com/page#section")).toBe("https://example.com/page");
  });

  it("removes hash from URL with trailing slash", () => {
    expect(normalizeUrl("https://example.com/#about")).toBe("https://example.com");
  });

  it("preserves query string", () => {
    expect(normalizeUrl("https://example.com/search?q=trout")).toBe("https://example.com/search?q=trout");
  });

  it("preserves path without trailing slash", () => {
    expect(normalizeUrl("https://example.com/reports/june")).toBe("https://example.com/reports/june");
  });

  it("returns the original string when URL is malformed", () => {
    expect(normalizeUrl("not-a-url")).toBe("not-a-url");
  });

  it("normalizes scheme and host to lowercase", () => {
    expect(normalizeUrl("HTTPS://Example.COM/")).toBe("https://example.com");
  });
});

// ── sameDomain ─────────────────────────────────────────────────────────────────

describe("sameDomain", () => {
  it("returns true for same domain", () => {
    expect(sameDomain("https://example.com/a", "https://example.com/b")).toBe(true);
  });

  it("returns false for different domains", () => {
    expect(sameDomain("https://example.com/page", "https://other.com/page")).toBe(false);
  });

  it("returns false when subdomains differ", () => {
    expect(sameDomain("https://www.example.com", "https://shop.example.com")).toBe(false);
  });

  it("ignores path, query, and hash in comparison", () => {
    expect(sameDomain("https://example.com/a?x=1#top", "https://example.com/b?y=2#bottom")).toBe(true);
  });

  it("returns false when first URL is malformed", () => {
    expect(sameDomain("not-a-url", "https://example.com")).toBe(false);
  });

  it("returns false when second URL is malformed", () => {
    expect(sameDomain("https://example.com", "not-a-url")).toBe(false);
  });

  it("returns false for two malformed URLs", () => {
    expect(sameDomain("foo", "bar")).toBe(false);
  });
});

// ── scrapeVisibleText ──────────────────────────────────────────────────────────

describe("scrapeVisibleText", () => {
  it("extracts body text", () => {
    const $ = cheerio.load("<html><body><p>Hello world</p></body></html>");
    expect(scrapeVisibleText($)).toBe("Hello world");
  });

  it("strips script tags", () => {
    const $ = cheerio.load("<html><body><p>Visible</p><script>var x = 1;</script></body></html>");
    expect(scrapeVisibleText($)).not.toContain("var x");
    expect(scrapeVisibleText($)).toContain("Visible");
  });

  it("strips style tags", () => {
    const $ = cheerio.load("<html><body><p>Text</p><style>.foo { color: red; }</style></body></html>");
    expect(scrapeVisibleText($)).not.toContain(".foo");
  });

  it("strips nav and footer elements", () => {
    const $ = cheerio.load("<html><body><nav>Nav links</nav><main>Main content</main><footer>Footer</footer></body></html>");
    const text = scrapeVisibleText($);
    expect(text).not.toContain("Nav links");
    expect(text).not.toContain("Footer");
    expect(text).toContain("Main content");
  });

  it("strips header elements", () => {
    const $ = cheerio.load("<html><body><header>Site header</header><article>Article</article></body></html>");
    expect(scrapeVisibleText($)).not.toContain("Site header");
  });

  it("collapses whitespace", () => {
    const $ = cheerio.load("<html><body><p>Line   one</p><p>Line   two</p></body></html>");
    const text = scrapeVisibleText($);
    expect(text).not.toMatch(/\s{2,}/);
  });

  it("returns empty string for empty body", () => {
    const $ = cheerio.load("<html><body></body></html>");
    expect(scrapeVisibleText($)).toBe("");
  });
});

// ── extractAnchors ─────────────────────────────────────────────────────────────

describe("extractAnchors", () => {
  it("resolves relative hrefs against baseUrl", () => {
    const $ = cheerio.load('<a href="/reports">Reports</a>');
    const anchors = extractAnchors($, "https://example.com");
    expect(anchors).toEqual([{ href: "https://example.com/reports", text: "Reports" }]);
  });

  it("includes absolute hrefs unchanged", () => {
    const $ = cheerio.load('<a href="https://example.com/shop">Shop</a>');
    const anchors = extractAnchors($, "https://example.com");
    expect(anchors[0].href).toBe("https://example.com/shop");
  });

  it("excludes non-http hrefs (mailto, tel)", () => {
    const $ = cheerio.load('<a href="mailto:info@example.com">Email</a><a href="tel:5551234">Call</a>');
    expect(extractAnchors($, "https://example.com")).toHaveLength(0);
  });

  it("excludes anchors without href", () => {
    const $ = cheerio.load('<a name="top">Anchor</a>');
    expect(extractAnchors($, "https://example.com")).toHaveLength(0);
  });

  it("trims link text", () => {
    const $ = cheerio.load('<a href="/page">  Report  </a>');
    const anchors = extractAnchors($, "https://example.com");
    expect(anchors[0].text).toBe("Report");
  });

  it("returns multiple anchors", () => {
    const $ = cheerio.load(`
      <a href="/about">About</a>
      <a href="/reports">Reports</a>
      <a href="https://external.com/page">External</a>
    `);
    const anchors = extractAnchors($, "https://example.com");
    expect(anchors).toHaveLength(3);
  });

  it("skips non-http hrefs like javascript: and data: schemes", () => {
    const $ = cheerio.load('<a href="javascript:void(0)">Click</a><a href="data:text/plain,hi">Data</a>');
    expect(extractAnchors($, "https://example.com")).toHaveLength(0);
  });
});

// ── isAllowedByRobots ──────────────────────────────────────────────────────────

function mockRobotsFetch(body: string, ok = true) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok,
      text: () => Promise.resolve(body),
    }),
  );
}

describe("isAllowedByRobots", () => {
  beforeEach(() => {
    // Each test needs a clean robots cache — reimport would work but resetting
    // via a fresh origin per test is simpler and avoids module reload overhead.
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("allows all paths when robots.txt is empty", async () => {
    mockRobotsFetch("");
    const result = await isAllowedByRobots("https://empty-robots.test/page");
    expect(result.allowed).toBe(true);
    expect(result.crawlDelay).toBe(0);
  });

  it("allows path not matched by any Disallow rule", async () => {
    mockRobotsFetch("User-agent: *\nDisallow: /admin\n");
    const result = await isAllowedByRobots("https://partial-disallow.test/about");
    expect(result.allowed).toBe(true);
  });

  it("disallows path matched by a Disallow rule", async () => {
    mockRobotsFetch("User-agent: *\nDisallow: /private\n");
    const result = await isAllowedByRobots("https://disallow-private.test/private/data");
    expect(result.allowed).toBe(false);
  });

  it("Allow overrides Disallow when Allow path is longer", async () => {
    const txt = "User-agent: *\nDisallow: /reports\nAllow: /reports/public\n";
    mockRobotsFetch(txt);
    const result = await isAllowedByRobots("https://allow-override.test/reports/public/2024");
    expect(result.allowed).toBe(true);
  });

  it("Disallow wins when it is longer than Allow", async () => {
    const txt = "User-agent: *\nAllow: /\nDisallow: /secret/deep\n";
    mockRobotsFetch(txt);
    const result = await isAllowedByRobots("https://disallow-wins.test/secret/deep/path");
    expect(result.allowed).toBe(false);
  });

  it("Allow and Disallow of equal length — Allow wins", async () => {
    const txt = "User-agent: *\nDisallow: /page\nAllow: /page\n";
    mockRobotsFetch(txt);
    const result = await isAllowedByRobots("https://equal-length.test/page/something");
    expect(result.allowed).toBe(true);
  });

  it("parses Crawl-delay correctly", async () => {
    mockRobotsFetch("User-agent: *\nDisallow:\nCrawl-delay: 5\n");
    const result = await isAllowedByRobots("https://crawl-delay.test/page");
    expect(result.crawlDelay).toBe(5);
  });

  it("ignores rules under non-wildcard User-agent blocks", async () => {
    const txt = "User-agent: Googlebot\nDisallow: /\n\nUser-agent: *\nDisallow:\n";
    mockRobotsFetch(txt);
    const result = await isAllowedByRobots("https://googlebot-only.test/page");
    expect(result.allowed).toBe(true);
  });

  it("allows all when robots.txt fetch fails (network error)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));
    const result = await isAllowedByRobots("https://fetch-error.test/page");
    expect(result.allowed).toBe(true);
    expect(result.crawlDelay).toBe(0);
  });

  it("allows all when robots.txt returns non-ok status", async () => {
    mockRobotsFetch("", false);
    const result = await isAllowedByRobots("https://robots-404.test/page");
    expect(result.allowed).toBe(true);
  });

  it("allows all when URL is malformed", async () => {
    const result = await isAllowedByRobots("not-a-url");
    expect(result.allowed).toBe(true);
    expect(result.crawlDelay).toBe(0);
  });
});

// ── scrapeShopDetails ──────────────────────────────────────────────────────────

function makeMockBrowser(): StealthBrowser {
  return {
    launch: vi.fn(),
    close: vi.fn(),
    fetchPage: vi.fn().mockResolvedValue({ html: null, status: 0, blocked: false, jsRendered: false }),
  } as unknown as StealthBrowser;
}

describe("scrapeShopDetails — ecommerce detection", () => {
  it("detects Shopify via cdn.shopify.com script", async () => {
    const html = '<html><body><script src="https://cdn.shopify.com/s/files/1/theme.js"></script></body></html>';
    const $ = cheerio.load(html);
    const details = await scrapeShopDetails($, "https://shopify-shop.test", makeMockBrowser());
    expect(details.sellsOnline).toBe(true);
  });

  it("detects WooCommerce via woocommerce script reference", async () => {
    const html = '<html><body><script src="/wp-content/plugins/woocommerce/assets/js/frontend/cart.js"></script></body></html>';
    const $ = cheerio.load(html);
    const details = await scrapeShopDetails($, "https://woo-shop.test", makeMockBrowser());
    expect(details.sellsOnline).toBe(true);
  });

  it("detects e-commerce via /cart path anchor", async () => {
    const html = '<html><body><a href="/cart">View Cart</a></body></html>';
    const $ = cheerio.load(html);
    const details = await scrapeShopDetails($, "https://cart-shop.test", makeMockBrowser());
    expect(details.sellsOnline).toBe(true);
  });

  it("detects e-commerce via /products path anchor", async () => {
    const html = '<html><body><a href="/products/dry-fly">Buy Flies</a></body></html>';
    const $ = cheerio.load(html);
    const details = await scrapeShopDetails($, "https://products-shop.test", makeMockBrowser());
    expect(details.sellsOnline).toBe(true);
  });

  it("detects e-commerce via add-to-cart href substring", async () => {
    const html = '<html><body><a href="?add-to-cart=123">Add to Cart</a></body></html>';
    const $ = cheerio.load(html);
    const details = await scrapeShopDetails($, "https://addtocart-shop.test", makeMockBrowser());
    expect(details.sellsOnline).toBe(true);
  });

  it("returns sellsOnline false for a plain informational page", async () => {
    const html = "<html><body><p>Welcome to our fly shop. Visit us in store!</p></body></html>";
    const $ = cheerio.load(html);
    const details = await scrapeShopDetails($, "https://plain-shop.test", makeMockBrowser());
    expect(details.sellsOnline).toBe(false);
  });
});

describe("scrapeShopDetails — fishing report detection", () => {
  it("detects fishing report via body text phrase", async () => {
    const html = "<html><body><p>Check out our weekly fishing report for the Madison River.</p></body></html>";
    const $ = cheerio.load(html);
    const details = await scrapeShopDetails($, "https://report-text.test", makeMockBrowser());
    expect(details.fishingReport).toBe(true);
  });

  it("detects fishing report via anchor path containing 'report'", async () => {
    const html = '<html><body><a href="/fishing-report-june">June Report</a></body></html>';
    const $ = cheerio.load(html);
    const details = await scrapeShopDetails($, "https://report-path.test", makeMockBrowser());
    expect(details.fishingReport).toBe(true);
  });

  it("detects fishing report via anchor path containing 'conditions'", async () => {
    const html = '<html><body><a href="/stream-conditions">River Conditions</a></body></html>';
    const $ = cheerio.load(html);
    const details = await scrapeShopDetails($, "https://conditions-path.test", makeMockBrowser());
    expect(details.fishingReport).toBe(true);
  });

  it("detects fishing report via 'hatch report' body text", async () => {
    const html = "<html><body><p>View our hatch report to plan your trip.</p></body></html>";
    const $ = cheerio.load(html);
    const details = await scrapeShopDetails($, "https://hatch-text.test", makeMockBrowser());
    expect(details.fishingReport).toBe(true);
  });

  it("returns fishingReport false for a shop with no report content", async () => {
    const html = '<html><body><p>Buy flies online.</p><a href="/shop">Shop Now</a></body></html>';
    const $ = cheerio.load(html);
    const details = await scrapeShopDetails($, "https://no-report.test", makeMockBrowser());
    expect(details.fishingReport).toBe(false);
  });
});

describe("scrapeShopDetails — social media detection", () => {
  it("extracts Facebook profile link", async () => {
    const html = '<html><body><a href="https://www.facebook.com/myflyshop">Facebook</a></body></html>';
    const $ = cheerio.load(html);
    const details = await scrapeShopDetails($, "https://social-shop.test", makeMockBrowser());
    expect(details.socialMedia).toContain("Facebook");
  });

  it("extracts Instagram profile link", async () => {
    const html = '<html><body><a href="https://www.instagram.com/myflyshop/">Instagram</a></body></html>';
    const $ = cheerio.load(html);
    const details = await scrapeShopDetails($, "https://social-shop2.test", makeMockBrowser());
    expect(details.socialMedia).toContain("Instagram");
  });

  it("extracts multiple social media platforms", async () => {
    const html = `<html><body>
      <a href="https://www.facebook.com/myflyshop">FB</a>
      <a href="https://www.youtube.com/channel/myflyshop">YT</a>
    </body></html>`;
    const $ = cheerio.load(html);
    const details = await scrapeShopDetails($, "https://multi-social.test", makeMockBrowser());
    expect(details.socialMedia).toContain("Facebook");
    expect(details.socialMedia).toContain("YouTube");
  });

  it("deduplicates repeated links to same platform", async () => {
    const html = `<html><body>
      <a href="https://www.facebook.com/myflyshop">FB</a>
      <a href="https://www.facebook.com/myflyshop/photos">FB Photos</a>
    </body></html>`;
    const $ = cheerio.load(html);
    const details = await scrapeShopDetails($, "https://dedup-social.test", makeMockBrowser());
    expect(details.socialMedia.filter((s) => s === "Facebook")).toHaveLength(1);
  });

  it("skips Facebook share buttons", async () => {
    const html = '<html><body><a href="https://www.facebook.com/sharer/sharer.php?u=https://example.com">Share</a></body></html>';
    const $ = cheerio.load(html);
    const details = await scrapeShopDetails($, "https://share-button.test", makeMockBrowser());
    expect(details.socialMedia).not.toContain("Facebook");
  });

  it("skips bare platform homepage links (path is /)", async () => {
    const html = '<html><body><a href="https://www.facebook.com/">Facebook</a></body></html>';
    const $ = cheerio.load(html);
    const details = await scrapeShopDetails($, "https://bare-homepage.test", makeMockBrowser());
    expect(details.socialMedia).not.toContain("Facebook");
  });

  it("skips Twitter/X intent links", async () => {
    const html = '<html><body><a href="https://twitter.com/intent/tweet?text=hello">Tweet</a></body></html>';
    const $ = cheerio.load(html);
    const details = await scrapeShopDetails($, "https://twitter-share.test", makeMockBrowser());
    expect(details.socialMedia).not.toContain("X (Twitter)");
  });

  it("returns empty socialMedia array when no social links present", async () => {
    const html = "<html><body><p>No social links here.</p></body></html>";
    const $ = cheerio.load(html);
    const details = await scrapeShopDetails($, "https://no-social.test", makeMockBrowser());
    expect(details.socialMedia).toEqual([]);
  });
});

describe("scrapeShopDetails — email extraction", () => {
  it("extracts email from a mailto: link", async () => {
    const html = '<html><body><a href="mailto:info@flyshop.com">Email Us</a></body></html>';
    const $ = cheerio.load(html);
    const details = await scrapeShopDetails($, "https://mailto-shop.test", makeMockBrowser());
    expect(details.email).toBe("info@flyshop.com");
  });

  it("extracts email from JSON-LD structured data", async () => {
    const html = `<html><body>
      <script type="application/ld+json">{"@type":"LocalBusiness","email":"jsonld@flyshop.com"}</script>
    </body></html>`;
    const $ = cheerio.load(html);
    const details = await scrapeShopDetails($, "https://jsonld-shop.test", makeMockBrowser());
    expect(details.email).toBe("jsonld@flyshop.com");
  });

  it("extracts email from body text via regex fallback", async () => {
    const html = "<html><body><p>Contact us at plain@flyshop.com for info.</p></body></html>";
    const $ = cheerio.load(html);
    const details = await scrapeShopDetails($, "https://plain-email.test", makeMockBrowser());
    expect(details.email).toBe("plain@flyshop.com");
  });

  it("returns empty string when no email found and no contact link", async () => {
    const html = "<html><body><p>No contact info here.</p></body></html>";
    const $ = cheerio.load(html);
    const details = await scrapeShopDetails($, "https://no-email.test", makeMockBrowser());
    expect(details.email).toBe("");
  });

  it("prefers mailto: over body regex", async () => {
    const html = '<html><body><a href="mailto:preferred@flyshop.com">Email</a><p>other@flyshop.com</p></body></html>';
    const $ = cheerio.load(html);
    const details = await scrapeShopDetails($, "https://prefer-mailto.test", makeMockBrowser());
    expect(details.email).toBe("preferred@flyshop.com");
  });
});
