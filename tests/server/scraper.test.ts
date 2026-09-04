import * as cheerio from "cheerio";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StealthBrowser } from "@/server/browser";

/* Stubbed open: these tests use unresolvable hostnames, which the real guard refuses. See net.test.ts. */
type Verdict = { ok: boolean; reason?: string };
// Typed with the url parameter, so a test can branch on it and `mock.calls` is indexable.
const checkUrl = vi.hoisted(() => vi.fn(async (_url: string): Promise<Verdict> => ({ ok: true })));
vi.mock("@/server/net", () => ({ checkUrl }));

const { extractAnchors, httpFetch, includesAny, isAllowedByRobots, normalizeUrl, sameDomain, scrapeShopDetails, scrapeVisibleText } = await import(
  "@/server/scraper"
);

// mockReset, so each test reads its own call history rather than every earlier test's.
beforeEach(() => {
  checkUrl.mockReset().mockImplementation(async () => ({ ok: true }));
});

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

// robots.txt goes through httpFetch now, so the mock needs a status, headers and a body stream.
function mockRobotsFetch(body: string, ok = true) {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve(streamResponse(body, { "content-type": "text/plain" }, ok ? 200 : 404))),
  );
}

describe("isAllowedByRobots", () => {
  beforeEach(() => {
    // Each test needs a clean robots cache; a fresh origin per test is simpler than reimporting the module.
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

// ── httpFetch: what it refuses to read ────────────────────────────────────────

/** A real Response, so headers.get and the body stream behave as in production; no headers means no content-type at all. */
function streamResponse(body: string, headers: Record<string, string> = {}, status = 200) {
  const bytes = new TextEncoder().encode(body);
  return new Response(
    new ReadableStream({
      start(c) {
        c.enqueue(bytes);
        c.close();
      },
    }),
    { status, headers },
  );
}

describe("httpFetch body guards", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("refuses a PDF served from an extensionless URL, which BINARY_EXT cannot catch", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(streamResponse("%PDF-1.4 endstream endobj", { "content-type": "application/pdf" })));
    const result = await httpFetch("https://shop.test/pathfinder-infosheet");
    expect(result.html).toBeNull();
    expect(result.error).toContain("application/pdf");
  });

  it("refuses stylesheets and scripts even though they are text/*", async () => {
    for (const type of ["text/css", "text/javascript", "image/png"]) {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(streamResponse("body{}", { "content-type": type })));
      expect((await httpFetch("https://shop.test/asset")).html).toBeNull();
    }
  });

  it("reads markup, and the declared charset is honored", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(streamResponse("<html><body>Caddis</body></html>", { "content-type": "text/html; charset=utf-8" })));
    expect((await httpFetch("https://shop.test/report")).html).toContain("Caddis");
  });

  it("still reads a body when the server declares no content-type at all", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(streamResponse("<html><body>no type</body></html>")));
    expect((await httpFetch("https://shop.test/")).html).toContain("no type");
  });

  it("caps an oversized body, including when it arrives as one chunk", async () => {
    const huge = `<html>${"x".repeat(3_000_000)}</html>`;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(streamResponse(huge, { "content-type": "text/html" })));
    const result = await httpFetch("https://shop.test/huge");
    expect(result.html).not.toBeNull();
    expect(result.html?.length).toBeLessThanOrEqual(2_000_000);
  });

  it("treats a 403 as blocked without reading its body", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(streamResponse("Access Denied", { "content-type": "text/html" }, 403)));
    const result = await httpFetch("https://shop.test/blocked");
    expect(result.blocked).toBe(true);
    expect(result.html).toBeNull();
  });
});

// ── the address guard, as scraper.ts uses it ──────────────────────────────────

// net.test.ts proves the guard decides right; these prove httpFetch asks it, on every hop.
describe("httpFetch consults the address guard", () => {
  const redirect = (to: string, status = 302) => streamResponse("", { location: to, "content-type": "text/html" }, status);
  const page = (body: string) => streamResponse(body, { "content-type": "text/html" });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("refuses a declined URL without opening a connection", async () => {
    const spy = vi.fn();
    vi.stubGlobal("fetch", spy);
    checkUrl.mockImplementation(async () => ({ ok: false, reason: "refused: 127.0.0.1 is not a public address" }));

    const result = await httpFetch("http://127.0.0.1:5432/");

    expect(spy).not.toHaveBeenCalled();
    expect(result.refused).toBe(true);
    expect(result.html).toBeNull();
    expect(result.error).toContain("refused");
  });

  it("does not retry a refusal — it is a policy answer, not a transport failure", async () => {
    vi.stubGlobal("fetch", vi.fn());
    checkUrl.mockImplementation(async () => ({ ok: false, reason: "refused" }));
    await httpFetch("http://10.0.0.1/");
    // One verdict, not one per retry: httpFetch returns rather than throwing.
    expect(checkUrl).toHaveBeenCalledTimes(1);
  });

  it("checks each hop of a redirect chain, not just the URL it was given", async () => {
    const spy = vi.fn().mockResolvedValueOnce(redirect("https://second.test/b")).mockResolvedValueOnce(page("<html><body>Caddis hatch</body></html>"));
    vi.stubGlobal("fetch", spy);

    const result = await httpFetch("https://first.test/a");

    expect(result.html).toContain("Caddis hatch");
    expect(checkUrl.mock.calls.map((c) => c[0])).toEqual(["https://first.test/a", "https://second.test/b"]);
  });

  it("stops a redirect that lands somewhere the guard declines", async () => {
    const spy = vi.fn().mockResolvedValue(redirect("http://169.254.169.254/latest/meta-data/"));
    vi.stubGlobal("fetch", spy);
    checkUrl.mockImplementation(async (url: string) => ({ ok: !url.includes("169.254"), reason: "refused: metadata" }));

    const result = await httpFetch("https://shop.test/start");

    // The first hop was fetched; the metadata address never was.
    expect(spy).toHaveBeenCalledTimes(1);
    expect(result.refused).toBe(true);
    expect(result.html).toBeNull();
  });

  it("resolves a relative Location against the URL that sent it", async () => {
    const spy = vi.fn().mockResolvedValueOnce(redirect("/reports/june")).mockResolvedValueOnce(page("<html><body>June</body></html>"));
    vi.stubGlobal("fetch", spy);

    await httpFetch("https://shop.test/deep/page");

    expect(checkUrl.mock.calls.map((c) => c[0])).toEqual(["https://shop.test/deep/page", "https://shop.test/reports/june"]);
  });

  it("gives up on a redirect loop rather than following it forever", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(redirect("https://loop.test/again")));
    const result = await httpFetch("https://loop.test/again");
    expect(result.html).toBeNull();
    expect(result.error).toBe("too many redirects");
  });

  it("treats a redirect with no Location as a dead end", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(streamResponse("", { "content-type": "text/html" }, 301))),
    );
    const result = await httpFetch("https://shop.test/x");
    expect(result.html).toBeNull();
    expect(result.error).toContain("no location");
  });

  it("guards the robots.txt fetch too, since that is the first request to any origin", async () => {
    vi.stubGlobal("fetch", vi.fn());
    checkUrl.mockImplementation(async () => ({ ok: false, reason: "refused" }));
    // No rules is still "allowed" — the guard stops the pages themselves at httpFetch.
    await isAllowedByRobots("http://192.168.1.1/admin");
    expect(checkUrl).toHaveBeenCalledWith("http://192.168.1.1/robots.txt");
  });
});

// ── robots.txt fetching, not parsing ──────────────────────────────────────────

describe("robots.txt is fetched once per origin", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("collapses concurrent misses on one origin into a single request", async () => {
    const spy = vi.fn(() => Promise.resolve(streamResponse("User-agent: *\nDisallow: /admin\n", { "content-type": "text/plain" })));
    vi.stubGlobal("fetch", spy);

    const results = await Promise.all([
      isAllowedByRobots("https://one-fetch.test/a"),
      isAllowedByRobots("https://one-fetch.test/b"),
      isAllowedByRobots("https://one-fetch.test/admin"),
    ]);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(results.map((r) => r.allowed)).toEqual([true, true, false]);
  });

  it("serves later pages from cache rather than refetching per page", async () => {
    const spy = vi.fn(() => Promise.resolve(streamResponse("User-agent: *\nCrawl-delay: 2\n", { "content-type": "text/plain" })));
    vi.stubGlobal("fetch", spy);

    const first = await isAllowedByRobots("https://cached-robots.test/page-1");
    for (const n of [2, 3, 4, 5]) await isAllowedByRobots(`https://cached-robots.test/page-${n}`);

    expect(spy).toHaveBeenCalledTimes(1);
    // A robots.txt with only Crawl-delay has no rules but still asks for the delay.
    expect(first.crawlDelay).toBe(2);
  });
});
