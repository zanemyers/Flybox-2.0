import type { CheerioAPI } from "cheerio";
import * as cheerio from "cheerio";
import {
  BLOCKED_OR_FORBIDDEN,
  EMAIL_REGEX,
  SHOP_KEYWORDS,
  SOCIAL_MEDIA_MAP,
} from "@/server/constants";
import type { Anchor, FetchResult } from "@/server/types/flybox";

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14.4; rv:125.0) Gecko/20100101 Firefox/125.0",
];

const REPORT_KEYWORDS = [
  "fishing report",
  "fish report",
  "conditions report",
  "hatch report",
  "water conditions",
  "fishing conditions",
];

function randomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function isJsRendered(html: string): boolean {
  const $ = cheerio.load(html);
  const bodyText = $("body").text().trim();
  const hasSpaRoot = $("#root, #app, #__next").length > 0;
  return hasSpaRoot && bodyText.length < 200;
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

export async function httpFetch(
  url: string,
  retries = 2,
): Promise<FetchResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": randomUserAgent(),
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
      redirect: "follow",
    });
    clearTimeout(timeout);
    const html = await res.text();
    const blocked =
      res.status === 403 ||
      res.status === 429 ||
      BLOCKED_OR_FORBIDDEN.some((phrase) => html.includes(phrase));
    return {
      html,
      status: res.status,
      blocked,
      jsRendered: !blocked && isJsRendered(html),
    };
  } catch (err) {
    clearTimeout(timeout);
    if (retries > 0) return httpFetch(url, retries - 1);
    return {
      html: null,
      status: 0,
      blocked: false,
      jsRendered: false,
      error: String(err),
    };
  }
}

export function loadHtml(html: string): CheerioAPI {
  return cheerio.load(html);
}

// ── Extraction helpers ───────────────────────────────────────────────────────

export function getEmail($: CheerioAPI): string {
  const text = $("body").html() ?? "";
  const match = EMAIL_REGEX.exec(text);
  return match ? match[0] : "";
}

export function getContactLink($: CheerioAPI, baseUrl: string): string | null {
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

export function hasOnlineShop($: CheerioAPI): boolean {
  const text = $("body").text().toLowerCase();
  const hrefs = $("a")
    .toArray()
    .map((el) => ($(el).attr("href") ?? "").toLowerCase());
  return (
    SHOP_KEYWORDS.some((kw) => text.includes(kw)) ||
    hrefs.some((href) => SHOP_KEYWORDS.some((kw) => href.includes(kw)))
  );
}

export function publishesFishingReport($: CheerioAPI): boolean {
  const text = $("body").text().toLowerCase();
  const linkText = $("a")
    .toArray()
    .map((el) => `${$(el).attr("href") ?? ""} ${$(el).text()}`.toLowerCase());
  return (
    REPORT_KEYWORDS.some((kw) => text.includes(kw)) ||
    linkText.some((lt) => REPORT_KEYWORDS.some((kw) => lt.includes(kw)))
  );
}

export function getSocialMedia($: CheerioAPI): string[] {
  const found: string[] = [];
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") ?? "";
    for (const { domain, name } of SOCIAL_MEDIA_MAP) {
      if (href.includes(domain) && !found.includes(name)) {
        found.push(name);
      }
    }
  });
  return found;
}

export function scrapeVisibleText($: CheerioAPI): string {
  $("script, style, noscript, iframe, nav, footer").remove();
  return $("body").text().replace(/\s+/g, " ").trim();
}

export function extractAnchors($: CheerioAPI, baseUrl: string): Anchor[] {
  const anchors: Anchor[] = [];
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") ?? "";
    const text = $(el).text().trim();
    try {
      const resolved = new URL(href, baseUrl).href;
      if (resolved.startsWith("http")) {
        anchors.push({ href: resolved, text });
      }
    } catch {
      // skip malformed
    }
  });
  return anchors;
}
