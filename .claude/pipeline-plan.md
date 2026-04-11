# Flybox Pipeline — HTTP-first / Playwright Fallback

## Context
The deprecated scraping implementation uses Playwright for every page request — even simple static HTML. The goal is to try plain `fetch` + cheerio first (~0.2-0.5s/page), falling back to Playwright only when a page is blocked (403/429) or JS-rendered. SerpAPI pagination is also currently sequential — parallelizing it is a free win.

All `src/server/` files are currently empty stubs waiting to be implemented.

---

## Dependencies
```bash
npm install cheerio
```
Cheerio 1.x ships its own types — no `@types/cheerio` needed.

---

## Implementation Order

### Phase 1 — Foundation
1. **`src/server/pipeline/types.ts`** — all shared types
   - `FlyboxPayload`, `FetchResult` (`html`, `status`, `url`, `blocked`, `jsRendered`), `BasicShop`, `ShopDetails`, `SiteInfo`, `CrawlSiteItem`, `Anchor`

2. **`src/server/fileUtils.ts`** — port from `_deprecated/lib/base/fileUtils.ts`, update imports only

3. **`src/server/baseTask.ts`** — port from `_deprecated/lib/base/baseTask.ts`, update imports to `@/server/db` and `@/server/constants`

4. **`src/server/baseAPI.ts`** — port from `_deprecated/lib/base/baseAPI.ts`, update imports

---

### Phase 2 — Core Scraping Utilities

5. **`src/server/scrapingUtils.ts`** — three sections:

   **URL helpers** (port from deprecated):
   - `normalizeUrl(url: string): string`
   - `sameDomain(urlA: string, urlB: string): boolean`

   **HTTP fetcher** (new):
   - `httpFetch(url: string, retries = 2): Promise<FetchResult>`
     - 10s timeout via `AbortController`
     - Random user-agent from same 4 profiles as StealthBrowser
     - `blocked`: status 401/403/429 OR `BLOCKED_OR_FORBIDDEN` keyword in html
     - `jsRendered`: html < 500 chars OR `<noscript>` count > 2 OR visible text ratio < 0.1 OR no block elements in body

   **Cheerio extraction layer** (new — mirrors deprecated Playwright helpers):
   - `getEmail(html, baseUrl)` — mailto links → regex → `MESSAGES.NO_EMAIL`
   - `getContactLink(html, baseUrl)` — `a[href*="contact"]` → resolved absolute URL
   - `hasOnlineShop(html)` — SHOP_KEYWORDS in anchors/buttons
   - `publishesFishingReport(html)` — "report" in anchor text
   - `getSocialMedia(html)` — hrefs matched against SOCIAL_MEDIA_MAP
   - `scrapeVisibleText(html, selector)` — `$(selector).first().text()` normalized
   - `extractAnchors(html, baseUrl)` — all `a[href]` resolved to absolute URLs

   > ⚠️ Cheerio `:contains()` is case-sensitive. Always use `.filter((_, el) => $(el).text().toLowerCase().includes(kw))` instead.

   > ⚠️ Cheerio doesn't auto-resolve relative hrefs. Always use `new URL(href, baseUrl).href` inside a try/catch.

6. **`src/server/browser.ts`** — port `StealthBrowser` from `_deprecated/lib/base/stealthBrowser.ts`, add:
   ```ts
   export function needsPlaywright(result: FetchResult): boolean {
     return result.blocked || result.jsRendered || result.html.trim().length === 0;
   }
   ```
   This is the **single decision point** for HTTP vs Playwright — both phases import it.

---

### Phase 3 — Pipeline Phases

7. **`src/server/pipeline/shopPhase.ts`**
   ```ts
   export async function runShopPhase(
     jobId, serpApiKey, query, lat, lng, task, browser
   ): Promise<{ shops, shopDetails, cacheBuffer }>
   ```
   - **SerpAPI pagination — parallel:**
     ```ts
     const pageStarts = Array.from({ length: Math.ceil(maxResults / 20) }, (_, i) => i * 20);
     const pages = await Promise.all(pageStarts.map(start => getJson({ ...params, start })));
     ```
     Deduplicate by `title + address` after merging.
   - **Per-shop scraping** via `PromisePool.withConcurrency(CONCURRENCY)`:
     1. `httpFetch(normalizeUrl(shop.website))`
     2. If `!needsPlaywright(result)`: cheerio extract all 4 data points; if email missing, fetch contact page via HTTP and retry `getEmail`
     3. Else: Playwright fallback for that shop only
   - Preserve `websiteCache: Map<string, ShopDetails>` to avoid re-scraping same domain
   - `await task.throwIfJobCanceled()` at top of each pool iteration

8. **`src/server/pipeline/crawlPhase.ts`**
   ```ts
   export async function runCrawlPhase(
     sites, crawlDepth, task, browser
   ): Promise<string[]>
   ```
   - `PromisePool.withConcurrency(CONCURRENCY)` across sites
   - Per-site: `TinyQueue` priority crawl — port `getPriority()` as a pure function from deprecated `fishUtils.ts`
   - **Per-page HTTP-first:**
     1. `httpFetch(url)`
     2. If `!needsPlaywright`: cheerio `scrapeVisibleText` + `extractAnchors`
     3. Else: `browser.newPage()` → `browser.load()` → `page.content()` → `page.close()`
   - `await task.throwIfJobCanceled()` each queue iteration

---

### Phase 4 — Orchestrator and API

9. **`src/server/pipeline/flybox.ts`** — extends `BaseTask`
   ```ts
   export default class Flybox extends BaseTask {
     async run(): Promise<void>
   }
   ```
   Sequence:
   1. Log start message
   2. `browser.launch()` — once, shared across both phases
   3. `runShopPhase(...)` → attach shop Excel as `secondaryFile`
   4. `throwIfJobCanceled()`
   5. Build `SiteInfo[]` from shops where `fishingReport === true`; use hardcoded defaults:
      - `keywords: ["report", "fishing", "fly"]`
      - `junkWords: ["login", "checkout", "cart"]`
      - `clickPhrases: ["read more", "view report"]`
      - `selector: "body"`
   6. `runCrawlPhase(...)` → get reports
   7. `throwIfJobCanceled()`
   8. `filterReports()` — port pure function from deprecated `fishTales.ts` (date/age/river filtering)
   9. Chunk + summarize with Gemini (`gemini-2.0-flash`) — port from deprecated `fishTales.ts`
   10. Attach summary as `primaryFile`
   11. `updateJobStatus(COMPLETED)`
   - `finally`: `browser.close()` — **only called here, never inside phases**

   > ⚠️ The deprecated `fishTales.ts` calls `browser.close()` inside `findReports` — this is a bug. Do NOT replicate.

10. **`src/server/flyboxApi.ts`** — extends `BaseAPI`
    - Parse `formData` into `FlyboxPayload`; split `riverList` string → `string[]`
    - Defaults: `crawlDepth = 20`, `tokenLimit = 50000`, `model = "gemini-2.0-flash"`
    - Create `Job` in DB, fire `new Flybox(job.id, payload).run()` without await
    - `getFiles`: `primaryFile` → `flybox_report.txt`, `secondaryFile` → `shop_details.xlsx`

11. **Wire API routes** in `src/app/api/flybox/`:
    - `route.ts` (POST) → `flyboxApi.handleCreateJob`
    - `[id]/updates/route.ts` (GET) → `flyboxApi.getJobUpdates`
    - `[id]/cancel/route.ts` (POST) → `flyboxApi.cancelJob`

---

### Phase 5 — DB Migration
12. Add `FLYBOX` to `JobType` enum in `db/schema.prisma`
    ```bash
    npx prisma migrate dev
    npx prisma generate
    ```

---

## File Summary

| File | Action | Source |
|------|--------|--------|
| `src/server/pipeline/types.ts` | Create | New |
| `src/server/scrapingUtils.ts` | Create | New (HTTP + cheerio) |
| `src/server/browser.ts` | Port + extend | `_deprecated/lib/base/stealthBrowser.ts` |
| `src/server/fileUtils.ts` | Port | `_deprecated/lib/base/fileUtils.ts` |
| `src/server/baseTask.ts` | Port | `_deprecated/lib/base/baseTask.ts` |
| `src/server/baseAPI.ts` | Port | `_deprecated/lib/base/baseAPI.ts` |
| `src/server/pipeline/shopPhase.ts` | Create | `_deprecated/lib/tasks/shop_reel/shopReel.ts` |
| `src/server/pipeline/crawlPhase.ts` | Create | `_deprecated/lib/tasks/fish_tales/fishTales.ts` |
| `src/server/pipeline/flybox.ts` | Create | New orchestrator |
| `src/server/flyboxApi.ts` | Create | New |
| `src/app/api/flybox/route.ts` | Implement | Stub exists |
| `db/schema.prisma` | Add FLYBOX to JobType | — |

---

## Verification
1. `npm run build` — no TypeScript errors
2. Set `RUN_HEADLESS=false`, run a test job, confirm most shops use the HTTP path (check logs)
3. Confirm a known JS-heavy site triggers Playwright fallback
4. Confirm SerpAPI pages fire in parallel (check timestamp logs)
5. Confirm `browser.close()` is called exactly once per job run
