import type { CheerioAPI } from "cheerio";

export function includesAny(target: string, terms: string[]): boolean {
  const lower = target.toLowerCase();
  return terms.some((t) => lower.includes(t));
}
import * as cheerio from "cheerio";
import type { FetchResult } from "@/server/browser";
import { needsPlaywright, type StealthBrowser } from "@/server/browser";

const BLOCKED_OR_FORBIDDEN = ["Access Denied", "Forbidden", "Too Many Requests", "Error 403", "Access Blocked", "You have been rate limited"];

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14.4; rv:125.0) Gecko/20100101 Firefox/125.0",
];

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i;

const SHOP_KEYWORDS = ["shop", "store", "buy", "products", "cart", "checkout"];

const REPORT_KEYWORDS = ["fishing report", "fish report", "conditions report", "hatch report", "water conditions", "fishing conditions"];

const SOCIAL_MEDIA_MAP = [
  { domain: "facebook.com", name: "Facebook" },
  { domain: "instagram.com", name: "Instagram" },
  { domain: "linkedin.com", name: "LinkedIn" },
  { domain: "tiktok.com", name: "TikTok" },
  { domain: "vimeo.com", name: "Vimeo" },
  { domain: "whatsapp.com", name: "WhatsApp" },
  { domain: "wa.me", name: "WhatsApp" },
  { domain: "x.com", name: "X (Twitter)" },
  { domain: "twitter.com", name: "X (Twitter)" },
  { domain: "youtube.com", name: "YouTube" },
];

// ── robots.txt ───────────────────────────────────────────────────────────────

const robotsCache = new Map<string, string>();

export async function isAllowedByRobots(url: string): Promise<boolean> {
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
    if (!robotsTxt) return true;

    const disallowed: string[] = [];
    let inWildcardBlock = false;
    for (const line of robotsTxt.split(/\r?\n/)) {
      const trimmed = line.trim().toLowerCase();
      if (trimmed.startsWith("user-agent:")) {
        inWildcardBlock = trimmed.replace("user-agent:", "").trim() === "*";
      } else if (inWildcardBlock && trimmed.startsWith("disallow:")) {
        const path = trimmed.replace("disallow:", "").trim();
        if (path) disallowed.push(path);
      }
    }

    return !disallowed.some((rule) => pathname.startsWith(rule));
  } catch {
    return true;
  }
}

// ── URL helpers ──────────────────────────────────────────────────────────────

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
    clearTimeout(timeout);
    const html = await res.text();
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

// ── Extraction helpers ───────────────────────────────────────────────────────

function getContactLink($: CheerioAPI, baseUrl: string): string | null {
  let result: string | null = null;
  $("a").each((_, el) => {
    const href = $(el).attr("href") ?? "";
    const text = $(el).text().toLowerCase();
    if (text.includes("contact") || href.toLowerCase().includes("contact")) {
      try {
        result = new URL(href, baseUrl).href;
      } catch {
        // skip malformed href
      }
      return false; // break
    }
  });
  return result;
}

function extractEmail($: CheerioAPI): string {
  let email = "";
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
  return (email || EMAIL_REGEX.exec($("body").html() ?? "")?.[0]) ?? "";
}

export interface ShopDetails {
  email: string;
  sellsOnline: string;
  fishingReport: string;
  socialMedia: string[];
}

export async function scrapeShopDetails($: CheerioAPI, baseUrl: string, browser: StealthBrowser): Promise<ShopDetails> {
  const bodyText = $("body").text().toLowerCase();
  let email = "";
  let sellsOnline = SHOP_KEYWORDS.some((kw) => bodyText.includes(kw));
  let fishingReport = REPORT_KEYWORDS.some((kw) => bodyText.includes(kw));
  const socialMedia = new Set<string>();

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") ?? "";
    const hrefLower = href.toLowerCase();
    const combined = `${hrefLower} ${$(el).text()}`.toLowerCase();

    if (!email && href.startsWith("mailto:")) {
      const match = EMAIL_REGEX.exec(href);
      if (match) email = match[0];
    }
    if (!sellsOnline && SHOP_KEYWORDS.some((kw) => hrefLower.includes(kw))) sellsOnline = true;
    if (!fishingReport && REPORT_KEYWORDS.some((kw) => combined.includes(kw))) fishingReport = true;
    for (const { domain, name } of SOCIAL_MEDIA_MAP) {
      if (href.includes(domain)) socialMedia.add(name);
    }
  });

  if (!email) email = EMAIL_REGEX.exec($("body").html() ?? "")?.[0] ?? "";

  if (!email) {
    const contactUrl = getContactLink($, baseUrl);
    if (contactUrl) {
      let result = await httpFetch(contactUrl);
      if (needsPlaywright(result)) result = await browser.fetchPage(contactUrl);
      if (result.html) email = extractEmail(cheerio.load(result.html));
    }
  }

  return { email, sellsOnline: sellsOnline ? "✅" : "❌", fishingReport: fishingReport ? "✅" : "❌", socialMedia: [...socialMedia] };
}

export function scrapeVisibleText($: CheerioAPI): string {
  $("script, style, noscript, iframe, header, nav, footer").remove();
  return $("body").text().replace(/\s+/g, " ").trim();
}

export function extractAnchors($: CheerioAPI, baseUrl: string): { href: string; text: string }[] {
  const anchors: { href: string; text: string }[] = [];
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") ?? "";
    try {
      const resolved = new URL(href, baseUrl).href;
      if (resolved.startsWith("http")) anchors.push({ href: resolved, text: $(el).text().trim() });
    } catch {
      // skip malformed
    }
  });
  return anchors;
}
