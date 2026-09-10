import type { CheerioAPI } from "cheerio";
import * as cheerio from "cheerio";
import type { FetchResult } from "@/server/browser";
import { needsPlaywright, type StealthBrowser } from "@/server/browser";
import { checkUrl } from "@/server/net";

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

/* Report detection is TOKEN based, not substring: "conditions" matched /terms-and-conditions and "hatch" matched /shop/hatchery-supply. */

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

/* Tracking params do not change the page but do change the string, so /grey-reef and /grey-reef?utm_source=local were crawled twice. */
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

/** True when a URL path looks like a fishing report page. Token based, so "/terms-and-conditions" no longer qualifies. */
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

// A JS shell: a mount-point div and almost no server-rendered text. Regex, not cheerio — this runs on every fetch.
const MOUNT_POINT = /<[a-z]+[^>]*\sid=["'](?:root|app|__next)["']/i;
const stripTags = (html: string) => html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ");

/* A crawler pointed at arbitrary sites is eventually handed something enormous, and ten of these run at once. */
const MAX_BODY_BYTES = 2_000_000;

/* Screened by what the response IS, not what its URL is called: a PDF from an extensionless URL reached cheerio as binary noise. css and javascript are excluded deliberately. */
const HTML_TYPE = /^\s*(?:text\/(?:html|plain|xml)|application\/(?:xhtml\+xml|xml))\s*(?:;|$)/i;

/** Frees the connection when we have decided not to read a body. */
async function discard(res: Response): Promise<void> {
  try {
    await res.body?.cancel();
  } catch {
    /* already closed */
  }
}

/* res.text() honored the declared charset, and windows-1252 is not rare on small business sites; an unknown label falls back to utf-8. */
function decoderFor(contentType: string): TextDecoder {
  const label = /charset=([\w-]+)/i.exec(contentType)?.[1];
  try {
    return new TextDecoder(label ?? "utf-8", { fatal: false });
  } catch {
    return new TextDecoder("utf-8", { fatal: false });
  }
}

/** Reads at most MAX_BODY_BYTES then stops pulling. Truncated markup still parses, so a capped read beats refusing outright. */
async function readCapped(res: Response, contentType: string): Promise<string> {
  if (!res.body) return res.text();

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (total < MAX_BODY_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.byteLength;
  }
  // Stopped on the cap rather than on end-of-stream, so the rest is never pulled.
  if (total >= MAX_BODY_BYTES) await discard(res);

  /* Clamped because the loop stops BETWEEN chunks: one chunk larger than the cap would sail past whole, and a body can arrive as one chunk. */
  const capped = Math.min(total, MAX_BODY_BYTES);
  const body = new Uint8Array(capped);
  let at = 0;
  for (const chunk of chunks) {
    if (at >= capped) break;
    const take = Math.min(chunk.byteLength, capped - at);
    body.set(chunk.subarray(0, take), at);
    at += take;
  }
  return decoderFor(contentType).decode(body);
}

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const MAX_REDIRECTS = 5;

export async function httpFetch(url: string, retries = 2): Promise<FetchResult> {
  const controller = new AbortController();
  // One budget for the whole chain, hops included — the same span `redirect: "follow"` covered.
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    let target = url;

    for (let hop = 0; ; hop++) {
      // Per hop, not once up front: `redirect: "follow"` walked the chain inside fetch, unseen.
      const verdict = await checkUrl(target);
      if (!verdict.ok) return { html: null, status: 0, blocked: false, jsRendered: false, refused: true, error: verdict.reason };

      const res = await fetch(target, {
        signal: controller.signal,
        headers: {
          "User-Agent": USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)],
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
        },
        redirect: "manual",
      });

      if (REDIRECT_STATUSES.has(res.status)) {
        await discard(res);
        if (hop >= MAX_REDIRECTS) return { html: null, status: res.status, blocked: false, jsRendered: false, error: "too many redirects" };

        const location = res.headers.get("location");
        if (!location) return { html: null, status: res.status, blocked: false, jsRendered: false, error: `${res.status} with no location` };
        try {
          target = new URL(location, target).href;
        } catch {
          return { html: null, status: res.status, blocked: false, jsRendered: false, error: "unparseable redirect target" };
        }
        continue;
      }

      // Knowable from the status alone, and the body of a 403 was never content worth reading.
      if (res.status === 403 || res.status === 429) {
        await discard(res);
        return { html: null, status: res.status, blocked: true, jsRendered: false };
      }

      /* Absent content-type is not a refusal — small sites omit it — and the byte cap still bounds the read. Returning, not throwing: the retry is for transport failures. */
      const contentType = res.headers.get("content-type") ?? "";
      if (contentType && !HTML_TYPE.test(contentType)) {
        await discard(res);
        return { html: null, status: res.status, blocked: false, jsRendered: false, error: `skipped ${contentType.split(";")[0].trim()}` };
      }

      const html = await readCapped(res, contentType);
      const blocked = BLOCKED_OR_FORBIDDEN.some((phrase) => html.includes(phrase));
      const jsRendered = !blocked && MOUNT_POINT.test(html) && stripTags(html).trim().length < 200;
      return { html, status: res.status, blocked, jsRendered };
    }
  } catch (err) {
    if (retries > 0) return httpFetch(url, retries - 1);
    return { html: null, status: 0, blocked: false, jsRendered: false, error: String(err) };
  } finally {
    clearTimeout(timeout);
  }
}

// ── robots.txt ───────────────────────────────────────────────────────────────

export interface RobotsResult {
  allowed: boolean;
  crawlDelay: number; // seconds; 0 means no delay specified
}

interface RobotsRule {
  pattern: string;
  allow: boolean;
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Parses the `User-agent: *` group. Directive NAMES are lowercased, values are not, because rule paths are case-sensitive. Consecutive User-agent lines form one group. */
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

/** Returns the matched pattern's length as its specificity, or -1 for no match. Supports `*` wildcards and a trailing `$` anchor. */
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

interface RobotsEntry {
  rules: RobotsRule[];
  crawlDelay: number;
  fetchedAt: number;
}

/* Caches PARSED rules, not raw text, since robots is consulted per URL. Bounded and expiring: module state in a long-lived server, and a permanent entry means a new Disallow never takes effect. */
const ROBOTS_TTL_MS = 6 * 60 * 60_000;
const ROBOTS_CACHE_MAX = 500;
const robotsCache = new Map<string, RobotsEntry>();

/* In-flight fetches, so ten shops starting on one origin make one request rather than ten. */
const robotsInFlight = new Map<string, Promise<RobotsEntry>>();

const ALLOW_ALL: RobotsEntry = { rules: [], crawlDelay: 0, fetchedAt: 0 };

function cacheRobots(origin: string, entry: RobotsEntry): void {
  robotsCache.set(origin, entry);
  /* Map iterates in insertion order, so the first key is the oldest. FIFO not LRU: a crawl visits one origin's pages together. */
  while (robotsCache.size > ROBOTS_CACHE_MAX) {
    const oldest = robotsCache.keys().next().value;
    if (oldest === undefined) break;
    robotsCache.delete(oldest);
  }
}

/** Never rejects: an unreachable or unparseable robots.txt means no rules, so allowed. Via httpFetch for the address guard and redirects. */
async function fetchRobots(origin: string): Promise<RobotsEntry> {
  try {
    const { html, status } = await httpFetch(`${origin}/robots.txt`);
    // Only a 2xx body is a rule set: a stray "Disallow:" in a 404 template would shut us out.
    const text = status >= 200 && status < 300 ? (html ?? "") : "";
    return { ...parseRobots(text), fetchedAt: Date.now() };
  } catch {
    return { ...ALLOW_ALL, fetchedAt: Date.now() };
  }
}

async function robotsFor(origin: string): Promise<RobotsEntry> {
  const cached = robotsCache.get(origin);
  if (cached && Date.now() - cached.fetchedAt < ROBOTS_TTL_MS) return cached;

  const inFlight = robotsInFlight.get(origin);
  if (inFlight) return inFlight;

  const pending = fetchRobots(origin).then((entry) => {
    cacheRobots(origin, entry);
    return entry;
  });
  robotsInFlight.set(origin, pending);
  try {
    return await pending;
  } finally {
    robotsInFlight.delete(origin);
  }
}

export async function isAllowedByRobots(url: string): Promise<RobotsResult> {
  let origin: string;
  let pathname: string;
  try {
    ({ origin, pathname } = new URL(url));
  } catch {
    return { allowed: true, crawlDelay: 0 };
  }

  const { rules, crawlDelay } = await robotsFor(origin);
  // Still returns the delay: a robots.txt carrying only Crawl-delay has no rules but does ask.
  if (rules.length === 0) return { allowed: true, crawlDelay };

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

// Five strategies in order of reliability; the fifth fetches the contact page, with baseUrl omitted on that call to prevent loops.
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

  // 3. JSON-LD — the value must be a string, and only the address is kept ("Email us at info@shop.com" was stored whole).
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

  // 4. Regex over visible TEXT, not raw HTML — scanning HTML matched src/srcset names like "logo@2x.png".
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

/** Body text with chrome stripped. Clones the body rather than re-parsing, which was a second full cheerio pass per page. */
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
