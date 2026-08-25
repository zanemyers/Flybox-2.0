# Flybox Overview

Flybox is a fly-fishing data aggregation tool built for [Rescue River](https://rescueriver.com). It finds local fly-fishing shops, identifies which ones publish fishing reports, and summarizes them with OpenAI. The output is a report summary and a shop directory, both downloadable.

**Flybox supplies its own API keys.** There is no bring-your-own-key flow, and no account. That single constraint shapes the rest of the design. Anything a caller can change is something a caller can bill the operator for. The search term and the summary prompt are therefore server-side constants in `src/server/config.ts`, not form fields. An editable prompt would be a free LLM endpoint; an editable search term would be a general-purpose Google Maps scraper.

The whole request payload is `{ latitude, longitude, rivers, summarize, shopDirectory }`.

## Pipeline

A single run of Flybox executes two sequential phases, both in `src/server/pipeline.ts`.

### Shop Phase

1. Fetches up to 100 shops from Google Maps via SerpAPI (5 pages, offsets 0–80), stopping early once a page comes back short
2. Deduplicates by website/name
3. Concurrently scrapes each shop's website (up to 10 at a time):
   - Checks `robots.txt` — skips disallowed sites, respects `Crawl-delay` up to 5s
   - Checks the address (`net.ts`) — every URL here is chosen by a third party. A host resolving to loopback, link-local or any other non-public range is refused, and each redirect hop is re-checked
   - HTTP fetch first; falls back to Playwright (stealth Chromium) if blocked or JS-rendered
   - Extracts: email, online store detection, fishing report detection, social media profiles
4. Saves all shops to `shop_details.xlsx`, unless the run turned the shop directory off. **The phase itself is never skipped.** The report phase filters on the `fishingReport` flags it sets. The option decides whether the workbook is built, not whether shops are searched.

### Report Phase

1. Filters to shops where `fishingReport: true`, then deduplicates by hostname
2. Optionally filters further by river name(s)
3. Crawls each site with a BFS priority queue (up to 3 sites at a time, depth-limited, keyword-prioritized)
4. Feeds the crawled text to OpenAI for summarization
5. Saves the summary to `report_summary.txt`, and the crawled source to `report_raw.txt`. The latter on summarized runs only: in raw mode `report_summary.txt` already is that text

**Each site gets a share of the character budget** — `TOKEN_CHAR_LIMIT / siteCount`, floored at 4,000. A single global cap applied per-site *and* to the concatenation silently dropped every site after the first once one filled it.

### Summarization

| | |
|---|---|
| Primary model | `gpt-5.6-luna` |
| Fallback model | `gpt-5.6-terra` — roughly 10x the price, so it runs only after the primary has exhausted the SDK's retries |
| Reasoning effort | Pinned to `none` — this is structured extraction, and reasoning tokens bill at the output rate |
| Output cap | 6,000 tokens |
| Char budget | 50,000 total when summarizing; 500,000 in raw mode |

Aborting and backoff are left to the OpenAI SDK's own `timeout` and `maxRetries`; a `Promise.race` timeout billed for requests nobody read. An **empty** response counts as a failure, not a success.

`summarize: false` skips the model entirely and returns the crawled text with the much larger raw budget, since there is no prompt to fit.

## Job System

All pipeline runs are tracked as `Job` records in PostgreSQL.

1. The client POSTs the payload as JSON to `/api/flybox`, which validates it, creates the job, fires the pipeline async, and returns `{ jobId }`. Invalid input gets a 400 — it never starts a doomed job.
2. The client polls `GET /api/flybox/[id]/updates` every 2 seconds for `{ message, status, createdAt, expected, files }`. `expected` is the manifest this run promised; `files` is readiness for those names only.
3. Downloads stream from `GET /api/flybox/[id]/files/[name]`, against an allow-list. File bytes are deliberately kept out of the poll: base64-encoding a several-hundred-KB xlsx every two seconds dominated both the query and the response.
4. `POST /api/flybox/[id]/cancel` sets a flag the pipeline checks between steps and inside the crawl loop. It only moves an `IN_PROGRESS` job, so it cannot overwrite a terminal status.

A run proves it is alive by stamping `Job.heartbeatAt` on the same cancel check, which already runs per shop and per crawled page. A process that dies mid-run — a deployment, a crash — leaves that stamp frozen. After `STALE_AFTER_MS` (`retention.ts`) the run counts as abandoned. The next poll marks it `FAILED` so a watching client is told, and `scripts/db_cleanup.ts` deletes the ones nobody is watching. Total age cannot stand in for this, because a legitimate raw-mode crawl of one large site has no tight upper bound.

Output files are stored as `Bytes` on the `Job` row and streamed to the client — nothing is written to disk. The job also stores the coordinates, rivers, and a `locationName` reverse-geocoded once per run. That is how a run can be described after the fact (Nominatim, best-effort, null on failure). The lookup runs inside the pipeline, overlapping the shop phase. On the request path, its 5s timeout was the user's to wait for.

## The Run Catalog

`/runs` lists the newest 15 completed runs, all downloadable; the newest 5 also show a snippet of the report. The retention window lives in `src/server/retention.ts`. The page, the privacy policy, and `scripts/db_cleanup.ts` all read it, so what is promised and what is pruned cannot drift apart.

**The catalog is public** — anyone can see the location and download the outputs of any recent run. This is disclosed in the privacy policy; keep it that way if the retention or the listing changes.

## Rate Limiting

`POST /api/flybox` is unauthenticated. Every run costs the operator 5 SerpAPI searches, an OpenAI call, and a headless browser crawling up to 100 third-party sites. `src/server/rateLimit.ts` counts and records a run in one transaction before the job is created:

| Scope | Default |
|-------|---------|
| Per client, per hour | 3 |
| Per client, per day | 10 |
| Global, per day | 40 |
| Global, per 30 days | 200 — sized against a 1,000-search SerpAPI plan at 5 searches per run |

Counts come from **`RunLedger`**, never from `Job`. Retention deletes `Job` rows on the catalog's schedule, so counting them made every window shorten to whatever survived the last prune. `RATE_LIMIT_WINDOW_MS` in `retention.ts` is now the one constant both the count and the prune read. Admission holds `pg_advisory_xact_lock` for the duration, because counting and inserting separately let a parallel burst read the same totals and all pass.

Downloads have their own, looser cap: 60 per client per minute, held **in memory** rather than in Postgres. A download costs a blob read rather than API credits, so it is not worth a database write per request. `/runs` publishes the job ids that address the download route, so it needed one. The 2s poll reads at most 500 log lines; it previously had no ceiling.

The client is identified by a **salted SHA-256 of its IP**, on `RunLedger.clientHash` and cleared at 24h; the raw address is never stored. Nothing identifying is kept on `Job` at all. The address comes from counting in from the right of `x-forwarded-for`, by `RATE_LIMIT_TRUSTED_PROXIES` (default 1). Only the rightmost entries were written by a proxy rather than by the caller. `src/app/robots.ts` disallows all crawlers — there is nothing to index and real cost in being crawled.

## Response Headers

`next.config.ts` sets `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy` and `Strict-Transport-Security` on everything, and turns off `X-Powered-By`.

The Content-Security-Policy is separate, in `src/proxy.ts`, because it needs a per-request nonce. `script-src` is `'self' 'nonce-…' 'strict-dynamic'`, so an injected script cannot run whatever its origin. `connect-src` is our own origin plus Nominatim, and `img-src` adds the OpenStreetMap tile hosts. `style-src-attr` stays `'unsafe-inline'` because Leaflet positions tiles with inline style attributes. `'unsafe-eval'` is added in development only — React uses `eval` there to rebuild server stack traces.

The nonce is why no page is prerendered: it cannot exist at build time. API routes are outside the matcher and carry only the static headers.

## Tech Stack

| Layer       | Tech                                                          |
|-------------|---------------------------------------------------------------|
| Framework   | Next.js 16 (App Router) + React 19                            |
| Database    | PostgreSQL via Prisma 7 (`@prisma/adapter-pg`)                |
| Scraping    | Cheerio (HTML parsing) + Playwright (JS-rendered pages)        |
| AI          | OpenAI (`gpt-5.6-luna`, fallback `gpt-5.6-terra`)             |
| Shop search | SerpAPI (Google Maps engine)                                  |
| Geocoding   | Nominatim (reverse only, once per run)                        |
| Map         | Leaflet + react-leaflet, marker icons served from `public/`    |
| Spreadsheet | ExcelJS                                                       |
| Styling     | Tailwind CSS v4 + DaisyUI v5                                  |
| Linting     | Biome                                                         |
| Tests       | Vitest (server only — see below)                              |

## Server Layer

`src/server/` is one responsibility per file:

| File | Owns |
|------|------|
| `pipeline.ts`  | `runFlybox()` — both phases, the crawl, and the OpenAI calls |
| `handler.ts`   | `JobHandler` — every DB write, plus `OUTPUT_FILES` and the workbook builder |
| `scraper.ts`   | HTTP fetching, robots.txt, email extraction, shop detail detection |
| `browser.ts`   | Playwright stealth wrapper and `needsPlaywright()` |
| `net.ts`       | `checkUrl()` — the address guard on every outbound fetch |
| `catalog.ts`   | The `/runs` query |
| `retention.ts` | How long data lives. Imports nothing, so the pruner can read it without loading the app |
| `rateLimit.ts` | Per-client and global caps |
| `geocode.ts`   | Reverse geocoding at job creation |
| `config.ts`    | The search term, the summary prompt, and key access |
| `db.ts`        | Prisma client singleton |

## Output Files

| File                 | Column          | Contents                                                                                   |
|----------------------|-----------------|--------------------------------------------------------------------------------------------|
| `report_summary.txt` | `primaryFile`   | The summary when summarizing, the raw crawled text otherwise. If summarization fails, the raw text under a `[Summarization unavailable]` heading |
| `shop_details.xlsx`  | `secondaryFile` | Shop directory: name, website, address, phone, rating, reviews, category, email, socials, online-store and report flags. Only when asked for |
| `report_raw.txt`     | `rawFile`       | The crawled source text, written only on summarized runs — in raw mode `primaryFile` already is it. Offered by `/runs`, never auto-downloaded  |

A run promises `report_summary.txt`, plus `shop_details.xlsx` when the shop directory was requested. `GET /api/flybox/[id]/updates` reports that manifest as `expected`, and reports readiness only for what is on it. The panel can therefore render rows before the bytes exist, and never downloads a file the caller did not ask for.

## Design System

The whole visual language — two hand-built DaisyUI themes, the navy/olive palette, and every primitive — lives in `src/client/styles/globals.css`. It is short, every value is deliberate, and contrast ratios are verified rather than guessed. Read it before styling anything. `CLAUDE.md` documents the constraints and the non-obvious UI patterns behind it.

## Testing

Vitest, node environment, `tests/**/*.test.ts`. `tests/server/scraper.regressions.test.ts` pins specific defects that have been fixed (substring report detection, robots.txt case and wildcard handling) — keep it green.

There is **no client-side test coverage**: the environment is `node` only and the `include` glob does not match `.tsx`. Adding component tests means adding jsdom and widening that glob.
