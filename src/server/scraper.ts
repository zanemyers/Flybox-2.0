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
const EMAIL_REGEX_ALL = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;

// Retina/asset filenames like "logo@2x.png" match the email shape exactly.
const ASSET_LOOKALIKE = /\.(png|jpe?g|gif|webp|avif|svg|css|js|mjs|json|xml|woff2?|ttf|otf|eot|ico|mp4|webm|mp3|pdf|zip)$/i;

const isRealEmail = (candidate: string) => !ASSET_LOOKALIKE.test(candidate);

// Platform fingerprints and unambiguous e-commerce signals
const ECOMMERCE_SCRIPTS = ["cdn.shopify.com", "woocommerce", "bigcommerce", "squarespace.com/commerce"];
const ECOMMERCE_PATH_PREFIXES = ["/cart", "/checkout", "/collections", "/products"]; // Shopify/WooCommerce path conventions
const ECOMMERCE_HREF_SUBSTRINGS = ["add-to-cart", "addtocart"]; // button/class patterns safe to substring-match

/* Fishing-report path detection is TOKEN based, not substring based. Substring
   matching made "/terms-and-conditions" (via "conditions") and
   "/shop/hatchery-supply" (via "hatch") read as fishing reports, which was true
   of nearly every commerce site. */

// Adjacent token pairs that identify a report page on their own.
const REPORT_STRONG_PHRASES = [
  "fishing report",
  "fishing reports",
  "fish report",
  "fish reports",
  "river report",
  "stream report",
  "water conditions",
  "fishing conditions",
  "stream conditions",
  "river conditions",
  "hatch chart",
  "hatch charts",
];
// Single tokens that identify a report page on their own.
const REPORT_STRONG_TOKENS = ["streamflow", "streamflows", "fishingreport", "fishreport"];
// Tokens that only count when the path also carries water/fish context.
const REPORT_WEAK_TOKENS = ["report", "reports", "condition", "conditions", "hatch", "hatches", "flow", "flows"];
const WATER_TOKENS = [
  "fish",
  "fishing",
  "fishery",
  "fly",
  "flies",
  "river",
  "rivers",
  "stream",
  "streams",
  "creek",
  "creeks",
  "water",
  "waters",
  "lake",
  "lakes",
  "trout",
  "angler",
  "angling",
  "tailwater",
];
// Paths that use report/condition vocabulary for entirely unrelated reasons.
const REPORT_BLOCKLIST_TOKENS = ["terms", "privacy", "policy", "legal", "shipping", "returns", "refund", "warranty", "annual", "financial", "investor"];

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

/* Tracking parameters do not change the page, but they do change the string, so
   /grey-reef and /grey-reef?utm_source=local were crawled and billed as two
   separate pages in a real run. */
const TRACKING_PARAMS = /^(utm_|fbclid$|gclid$|msclkid$|mc_cid$|mc_eid$|_ga$|ref$|source$)/i;

export function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = "";
    for (const key of [...u.searchParams.keys()]) {
      if (TRACKING_PARAMS.test(key)) u.searchParams.delete(key);
    }
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

/** Splits a URL path into lowercase word tokens: "/Fly-Fishing/Reports" -> ["fly","fishing","reports"]. */
export function pathTokens(pathname: string): string[] {
  return pathname
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/** True when a URL path looks like a fishing report page. Token based, so
    "/terms-and-conditions" and "/shop/hatchery-supply" no longer qualify. */
export function isReportPath(pathname: string): boolean {
  const tokens = pathTokens(pathname);
  if (tokens.length === 0) return false;
  if (tokens.some((t) => REPORT_BLOCKLIST_TOKENS.includes(t))) return false;

  if (tokens.some((t) => REPORT_STRONG_TOKENS.includes(t))) return true;

  const joined = tokens.join(" ");
  if (REPORT_STRONG_PHRASES.some((p) => joined.includes(p))) return true;

  const hasWeak = tokens.some((t) => REPORT_WEAK_TOKENS.includes(t));
  const hasWater = tokens.some((t) => WATER_TOKENS.includes(t));
  return hasWeak && hasWater;
}

// ── HTTP fetcher ─────────────────────────────────────────────────────────────

// A JS shell: a mount-point div and almost no server-rendered text. Detected with
// regexes rather than a cheerio parse — this ran on every fetch, and the page is
// parsed properly by the caller anyway.
const MOUNT_POINT = /<[a-z]+[^>]*\sid=["'](?:root|app|__next)["']/i;
const stripTags = (html: string) => html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ");

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
    const jsRendered = !blocked && MOUNT_POINT.test(html) && stripTags(html).trim().length < 200;
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

interface RobotsRule {
  pattern: string;
  allow: boolean;
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Parses the `User-agent: *` group. Directive NAMES are lowercased; values keep
    their case, because rule paths are case-sensitive and the URL path is not
    lowercased either. Consecutive User-agent lines form one group. */
export function parseRobots(robotsTxt: string): { rules: RobotsRule[]; crawlDelay: number } {
  const rules: RobotsRule[] = [];
  let crawlDelay = 0;
  let inWildcard = false;
  let sawDirective = false;

  for (const rawLine of robotsTxt.split(/\r?\n/)) {
    const line = rawLine.split("#")[0].trim(); // strip inline comments
    if (!line) continue;
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    const name = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();

    if (name === "user-agent") {
      if (sawDirective) {
        inWildcard = false;
        sawDirective = false;
      }
      if (value === "*") inWildcard = true;
      continue;
    }

    sawDirective = true;
    if (!inWildcard) continue;

    if (name === "allow" && value) rules.push({ pattern: value, allow: true });
    else if (name === "disallow" && value) rules.push({ pattern: value, allow: false });
    else if (name === "crawl-delay") {
      const n = Number.parseFloat(value);
      if (!Number.isNaN(n)) crawlDelay = n;
    }
  }

  return { rules, crawlDelay };
}

/** Returns the matched pattern's length as its specificity, or -1 for no match.
    Supports `*` wildcards and a trailing `$` anchor. */
export function robotsMatchLength(pattern: string, pathname: string): number {
  if (!pattern.includes("*") && !pattern.endsWith("$")) {
    return pathname.startsWith(pattern) ? pattern.length : -1;
  }
  const anchored = pattern.endsWith("$");
  const body = anchored ? pattern.slice(0, -1) : pattern;
  const source = `^${body.split("*").map(escapeRegex).join(".*")}${anchored ? "$" : ""}`;
  try {
    return new RegExp(source).test(pathname) ? pattern.length : -1;
  } catch {
    return -1;
  }
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

    const { rules, crawlDelay } = parseRobots(robotsTxt);

    // Most specific rule wins; Allow beats Disallow on equal specificity.
    let longestAllow = -1;
    let longestDisallow = -1;
    for (const rule of rules) {
      const len = robotsMatchLength(rule.pattern, pathname);
      if (len < 0) continue;
      if (rule.allow) longestAllow = Math.max(longestAllow, len);
      else longestDisallow = Math.max(longestDisallow, len);
    }

    const allowed = longestDisallow < 0 || longestAllow >= longestDisallow;
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
      if (match && isRealEmail(match[0])) {
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
    const match = EMAIL_REGEX.exec(decoded);
    if (match && isRealEmail(match[0])) {
      email = match[0];
      return false;
    }
  });
  if (email) return email;

  // 3. JSON-LD structured data — some sites embed contact info in schema.org markup.
  //    The value must be a string and only the address itself is kept: an
  //    "email": "Email us at info@shop.com" used to be stored whole.
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).html() ?? "{}");
      const found = data?.email ?? data?.contactPoint?.email;
      if (typeof found !== "string") return;
      const match = EMAIL_REGEX.exec(found);
      if (match && isRealEmail(match[0])) {
        email = match[0];
        return false;
      }
    } catch {
      /* skip malformed */
    }
  });
  if (email) return email;

  // 4. Regex over the page's visible TEXT, not its raw HTML. Scanning the HTML
  //    matched src/srcset filenames such as "logo@2x.png".
  for (const candidate of $("body").text().match(EMAIL_REGEX_ALL) ?? []) {
    if (isRealEmail(candidate)) return candidate;
  }

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

  // Fishing report: body text phrases or a report-shaped path
  const fishingReport = includesAny(bodyText, REPORT_TEXT_KEYWORDS) || anchorUrls.some(({ pathname }) => isReportPath(pathname));

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

/** Body text with chrome stripped. Clones the body rather than re-parsing the
    whole document, which was a second full cheerio pass on every crawled page. */
export function scrapeVisibleText($: CheerioAPI): string {
  const $body = $("body").clone();
  $body.find("script, style, noscript, iframe, header, nav, footer").remove();
  return $body.text().replace(/\s+/g, " ").trim();
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
