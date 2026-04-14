import { GoogleGenAI } from "@google/genai";
import { PromisePool } from "@supercharge/promise-pool";
import TinyQueue from "tinyqueue";
import { needsPlaywright, type StealthBrowser } from "@/server/browser";
import type { Anchor } from "@/server/scrapingUtils";
import {
  extractAnchors,
  httpFetch,
  isAllowedByRobots,
  loadHtml,
  normalizeUrl,
  sameDomain,
  scrapeVisibleText,
} from "@/server/scrapingUtils";
import type { FlyboxPayload, SiteInfo } from "@/server/shopPhase";

const MAX_DEPTH = 20;
const CRAWL_CONCURRENCY = 3;
const TOKEN_CHAR_LIMIT = 200_000;
const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_FALLBACK_MODEL = "gemini-2.0-flash";

interface QueueItem {
  url: string;
  depth: number;
  priority: number;
}

function getPriority(anchor: Anchor): number {
  const combined = `${anchor.href} ${anchor.text}`.toLowerCase();
  if (combined.includes("report")) return 0;
  if (combined.includes("fishing") || combined.includes("fish")) return 1;
  if (combined.includes("conditions") || combined.includes("hatch")) return 2;
  return 3;
}

async function crawlSite(baseUrl: string, browser: StealthBrowser): Promise<string> {
  const visited = new Set<string>();
  const queue = new TinyQueue<QueueItem>(
    [{ url: normalizeUrl(baseUrl), depth: 0, priority: 0 }],
    (a, b) => a.priority - b.priority,
  );
  const chunks: string[] = [];
  let totalChars = 0;

  while (queue.length > 0 && totalChars < TOKEN_CHAR_LIMIT) {
    const item = queue.pop();
    if (!item) break;
    const { url, depth } = item;

    if (visited.has(url) || depth > MAX_DEPTH) continue;
    if (!(await isAllowedByRobots(url))) continue;
    visited.add(url);

    let result = await httpFetch(url);
    if (needsPlaywright(result)) result = await browser.fetchPage(url);
    if (!result.html || result.blocked) continue;

    const $ = loadHtml(result.html);
    const text = scrapeVisibleText($);
    if (text) {
      chunks.push(`--- ${url} ---\n${text}`);
      totalChars += text.length;
    }

    if (depth < MAX_DEPTH) {
      for (const anchor of extractAnchors($, url)) {
        const normalized = normalizeUrl(anchor.href);
        if (!visited.has(normalized) && sameDomain(baseUrl, normalized)) {
          queue.push({
            url: normalized,
            depth: depth + 1,
            priority: getPriority(anchor),
          });
        }
      }
    }
  }

  return chunks.join("\n\n").slice(0, TOKEN_CHAR_LIMIT);
}

export async function runCrawlPhase(
  reportShops: SiteInfo[],
  payload: FlyboxPayload,
  browser: StealthBrowser,
  log: (msg: string) => Promise<void>,
  isCanceled: () => Promise<boolean>,
): Promise<string> {
  await log(`🕷️ Crawling ${reportShops.length} shop site(s) for fishing reports…`);

  const seen = new Set<string>();
  const uniqueSites = reportShops.filter((shop) => {
    try {
      const hostname = new URL(shop.website).hostname;
      if (seen.has(hostname)) return false;
      seen.add(hostname);
      return true;
    } catch {
      return false;
    }
  });

  const siteTexts: Array<{ name: string; text: string }> = [];

  await PromisePool.withConcurrency(CRAWL_CONCURRENCY)
    .for(uniqueSites)
    .process(async (shop) => {
      if (await isCanceled()) return;
      await log(`  🔗 Crawling: ${shop.name}`);
      try {
        const text = await crawlSite(shop.website, browser);
        if (text.trim()) siteTexts.push({ name: shop.name, text });
      } catch (err) {
        await log(`  ⚠️ Failed to crawl ${shop.name}: ${String(err)}`);
      }
    });

  if (siteTexts.length === 0) return "No fishing report content found.";

  await log(`🤖 Summarizing ${siteTexts.length} site(s) with Gemini…`);

  const combined = siteTexts
    .map((s) => `==== ${s.name} ====\n${s.text}`)
    .join("\n\n")
    .slice(0, TOKEN_CHAR_LIMIT);

  const ai = new GoogleGenAI({ apiKey: payload.geminiApiKey });
  const prompt = `${payload.summaryPrompt}\n\n${combined}`;

  function parseRetryDelay(err: unknown): number | null {
    const msg = String(err);
    if (!msg.includes("429") && !msg.includes("RESOURCE_EXHAUSTED")) return null;
    const match = msg.match(/"retryDelay"\s*:\s*"(\d+)s"/);
    return match ? Number(match[1]) * 1000 : 60_000;
  }

  async function generateWithRetry(model: string, maxAttempts = 3): Promise<Awaited<ReturnType<typeof ai.models.generateContent>> | null> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await ai.models.generateContent({ model, contents: prompt });
      } catch (err) {
        const retryMs = parseRetryDelay(err);
        if (retryMs !== null && attempt < maxAttempts) {
          const waitSec = Math.ceil(retryMs / 1000);
          await log(`⏳ Gemini rate limit hit — retrying in ${waitSec}s (attempt ${attempt}/${maxAttempts})…`);
          await new Promise((res) => setTimeout(res, retryMs));
          continue;
        }
        const is503 = String(err).includes("503") || String(err).includes("UNAVAILABLE");
        if (is503) return null;
        throw err;
      }
    }
    return null;
  }

  let response = await generateWithRetry(GEMINI_MODEL);

  if (!response) {
    await log(`⚠️ ${GEMINI_MODEL} unavailable — falling back to ${GEMINI_FALLBACK_MODEL}…`);
    response = await generateWithRetry(GEMINI_FALLBACK_MODEL);
    if (!response) throw new Error(`${GEMINI_FALLBACK_MODEL} is also unavailable after retries.`);
  }

  await log("✅ Summary complete.");
  return response.text ?? "";
}
