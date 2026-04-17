import type { CheerioAPI } from "cheerio";
import * as cheerio from "cheerio";
import type { FetchResult } from "@/server/browser";
import { needsPlaywright, type StealthBrowser } from "@/server/browser";

// ── Constants ────────────────────────────────────────────────────────────────

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14.4; rv:125.0) Gecko/20100101 Firefox/125.0",
];

const BLOCKED_OR_FORBIDDEN = ["Access Denied", "Forbidden", "Too Many Requests", "Error 403", "Access Blocked", "You have been rate limited"];

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i;

// Platform fingerprints and unambiguous e-commerce signals
const ECOMMERCE_SCRIPTS = ["cdn.shopify.com", "woocommerce", "bigcommerce", "squarespace.com/commerce"];
const ECOMMERCE_PATH_PREFIXES = ["/cart", "/checkout", "/collections", "/products"]; // Shopify/WooCommerce path conventions
const ECOMMERCE_HREF_SUBSTRINGS = ["add-to-cart", "addtocart"]; // button/class patterns safe to substring-match

// Path segments and anchor text patterns that indicate a fishing report page
const REPORT_HREF_KEYWORDS = ["report", "conditions", "hatch", "flows", "streamflow"];
const REPORT_TEXT_KEYWORDS = ["fishing report", "fish report", "conditions report", "hatch report", "water conditions", "fishing conditions"];

// Share/intent paths to exclude — these are share buttons, not profile links
const SOCIAL_SHARE_PATHS = ["sharer", "intent/tweet", "intent/post", "sharing/sharer", "pin/create"];
const SOCIAL_MEDIA_MAP = [
  { domain: "facebook.com", name: "Facebook" },
  { domain: "instagram.com", name: "Instagram" },
  { domain: "linkedin.com", name: "LinkedIn" },
  { domain: "pinterest.com", name: "Pinterest" },
  { domain: "tiktok.com", name: "TikTok" },
  { domain: "vimeo.com", name: "Vimeo" },
  { domain: "x.com", name: "X (Twitter)" },
  { domain: "twitter.com", name: "X (Twitter)" },
  { domain: "youtube.com", name: "YouTube" },
];

// ── Utilities ────────────────────────────────────────────────────────────────

export function includesAny(target: string, terms: string[]): boolean {
  const lower = target.toLowerCase();
  return terms.some((t) => lower.includes(t));
}

export function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = "";
    return u.href.replace(/\/$/, "");
  } catch {
    return url;
  }
}

export function sameDomain(url1: string, url2: string): boolean {
  try {
    return new URL(url1).hostname === new URL(url2).hostname;
  } catch {
    return false;
  }
}

// ── HTTP fetcher ─────────────────────────────────────────────────────────────

export async function httpFetch(url: string, retries = 2): Promise<FetchResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)],
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
      redirect: "follow",
    });
    const html = await res.text();
    clearTimeout(timeout);
    const blocked = res.status === 403 || res.status === 429 || BLOCKED_OR_FORBIDDEN.some((phrase) => html.includes(phrase));
    const $ = cheerio.load(html);
    const jsRendered = !blocked && $("#root, #app, #__next").length > 0 && $("body").text().trim().length < 200;
    return { html, status: res.status, blocked, jsRendered };
  } catch (err) {
    clearTimeout(timeout);
    if (retries > 0) return httpFetch(url, retries - 1);
    return { html: null, status: 0, blocked: false, jsRendered: false, error: String(err) };
  }
}

// ── robots.txt ───────────────────────────────────────────────────────────────

const robotsCache = new Map<string, string>();

export interface RobotsResult {
  allowed: boolean;
  crawlDelay: number; // seconds; 0 means no delay specified
}

export async function isAllowedByRobots(url: string): Promise<RobotsResult> {
  try {
    const { origin, pathname } = new URL(url);

    if (!robotsCache.has(origin)) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5_000);
        const res = await fetch(`${origin}/robots.txt`, { signal: controller.signal });
        clearTimeout(timer);
        robotsCache.set(origin, res.ok ? await res.text() : "");
      } catch {
        robotsCache.set(origin, "");
      }
    }

    const robotsTxt = robotsCache.get(origin) ?? "";
    if (!robotsTxt) return { allowed: true, crawlDelay: 0 };

    const allow: string[] = [];
    const disallow: string[] = [];
    let crawlDelay = 0;
    let inWildcardBlock = false;
    const val = (line: string, directive: string) => line.slice(directive.length).trim();

    for (const line of robotsTxt.split(/\r?\n/)) {
      const t = line.trim().toLowerCase();
      if (t.startsWith("user-agent:")) {
        inWildcardBlock = val(t, "user-agent:") === "*";
      } else if (inWildcardBlock) {
        if (t.startsWith("allow:")) {
          const p = val(t, "allow:");
          if (p) allow.push(p);
        } else if (t.startsWith("disallow:")) {
          const p = val(t, "disallow:");
          if (p) disallow.push(p);
        } else if (t.startsWith("crawl-delay:")) {
          const n = parseFloat(val(t, "crawl-delay:"));
          if (!Number.isNaN(n)) crawlDelay = n;
        }
      }
    }

    // Most specific rule wins; Allow beats Disallow on equal length
    const longestDisallow = disallow.filter((r) => pathname.startsWith(r)).reduce((a, b) => (a.length >= b.length ? a : b), "");
    const longestAllow = allow.filter((r) => pathname.startsWith(r)).reduce((a, b) => (a.length >= b.length ? a : b), "");
    const allowed = longestDisallow === "" || longestAllow.length >= longestDisallow.length;

    return { allowed, crawlDelay };
  } catch {
    return { allowed: true, crawlDelay: 0 };
  }
}

// ── Scraping ─────────────────────────────────────────────────────────────────

function getContactLink($: CheerioAPI, baseUrl: string): string | null {
  const anchor = $("a[href]")
    .toArray()
    .find((el) => {
      const href = $(el).attr("href") ?? "";
      return $(el).text().toLowerCase().includes("contact") || href.toLowerCase().includes("contact");
    });
  if (!anchor) return null;
  try {
    return new URL($(anchor).attr("href") ?? "", baseUrl).href;
  } catch {
    return null;
  }
}

// Extracts an email from a page using four strategies in order of reliability.
// If baseUrl is provided and all strategies fail, falls back to fetching the
// contact page (baseUrl is omitted on that recursive call to prevent loops).
async function extractEmail($: CheerioAPI, baseUrl: string, browser: StealthBrowser): Promise<string> {
  let email = "";

  // 1. mailto: links — most explicit signal
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") ?? "";
    if (href.startsWith("mailto:")) {
      const match = EMAIL_REGEX.exec(href);
      if (match) {
        email = match[0];
        return false;
      }
    }
  });
  if (email) return email;

  // 2. Cloudflare email protection — CF replaces mailto: with an encoded data-cfemail attribute
  $("[data-cfemail]").each((_, el) => {
    const encoded = $(el).attr("data-cfemail") ?? "";
    if (!encoded) return;
    const key = parseInt(encoded.slice(0, 2), 16);
    let decoded = "";
    for (let i = 2; i < encoded.length; i += 2) decoded += String.fromCharCode(parseInt(encoded.slice(i, i + 2), 16) ^ key);
    if (EMAIL_REGEX.test(decoded)) {
      email = decoded;
      return false;
    }
  });
  if (email) return email;

  // 3. JSON-LD structured data — some sites embed contact info in schema.org markup
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).html() ?? "{}");
      const found = data?.email ?? data?.contactPoint?.email;
      if (found && EMAIL_REGEX.test(found)) {
        email = found;
        return false;
      }
    } catch {
      /* skip malformed */
    }
  });
  if (email) return email;

  // 4. Regex on raw body HTML — catches plain-text emails not wrapped in a mailto:
  email = EMAIL_REGEX.exec($("body").html() ?? "")?.[0] ?? "";
  if (email) return email;

  // 5. Fetch the contact page and retry (one level deep; baseUrl="" skips this)
  if (baseUrl) {
    const contactUrl = getContactLink($, baseUrl);
    if (contactUrl) {
      let result = await httpFetch(contactUrl);
      if (needsPlaywright(result)) result = await browser.fetchPage(contactUrl);
      if (result.html) return extractEmail(cheerio.load(result.html), "", browser);
    }
  }

  return "";
}

export interface ShopDetails {
  email: string;
  sellsOnline: boolean;
  fishingReport: boolean;
  socialMedia: string[];
}

export async function scrapeShopDetails($: CheerioAPI, baseUrl: string, browser: StealthBrowser): Promise<ShopDetails> {
  const $body = $("body");
  const bodyHtml = $body.html() ?? "";
  const bodyText = $body.text();

  // Parse anchor URLs once; skip malformed
  const anchorUrls = $("a[href]")
    .toArray()
    .flatMap((el) => {
      const raw = $(el).attr("href") ?? "";
      try {
        const { hostname, pathname } = new URL(raw, baseUrl);
        return [{ raw, hostname, pathname }];
      } catch {
        return [];
      }
    });

  // E-commerce: platform script fingerprints are most reliable; fall back to path-prefix or button pattern matches
  const sellsOnline =
    includesAny(bodyHtml, ECOMMERCE_SCRIPTS) ||
    anchorUrls.some(({ raw, pathname }) => includesAny(raw, ECOMMERCE_HREF_SUBSTRINGS) || ECOMMERCE_PATH_PREFIXES.some((p) => pathname.startsWith(p)));

  // Fishing report: body text phrases or report-specific path segments
  const fishingReport = includesAny(bodyText, REPORT_TEXT_KEYWORDS) || anchorUrls.some(({ pathname }) => includesAny(pathname, REPORT_HREF_KEYWORDS));

  const socialMedia = new Set<string>();
  for (const { hostname, pathname } of anchorUrls) {
    // Skip share buttons and bare platform homepages (no meaningful path)
    if (includesAny(pathname, SOCIAL_SHARE_PATHS)) continue;
    if (pathname === "/" || pathname === "") continue;
    for (const { domain, name } of SOCIAL_MEDIA_MAP) {
      if (hostname.endsWith(domain)) socialMedia.add(name);
    }
  }

  const email = await extractEmail($, baseUrl, browser);

  return { email, sellsOnline, fishingReport, socialMedia: [...socialMedia] };
}

export function scrapeVisibleText($: CheerioAPI): string {
  const $$ = cheerio.load($.html() ?? "");
  $$("script, style, noscript, iframe, header, nav, footer").remove();
  return $$("body").text().replace(/\s+/g, " ").trim();
}

export function extractAnchors($: CheerioAPI, baseUrl: string): { href: string; text: string }[] {
  return $("a[href]")
    .toArray()
    .flatMap((el) => {
      const href = $(el).attr("href") ?? "";
      try {
        const resolved = new URL(href, baseUrl).href;
        return resolved.startsWith("http") ? [{ href: resolved, text: $(el).text().trim() }] : [];
      } catch {
        return [];
      }
    });
}
