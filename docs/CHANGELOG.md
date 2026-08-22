# Changelog

## [Unreleased]

This section is the net delta since the last release, not a running log — where a
later change superseded an earlier one, only the outcome is listed.

### Added
- Flybox now supplies its own API keys: no key fields, no account, no bring-your-own-key flow
- `src/server/rateLimit.ts` — per-client (3/hour, 10/day) and global (40/day, 200/30 days) caps enforced before a job is created; client identified by a salted SHA-256 of its IP on `Job.clientHash`
- `RATE_LIMIT_SALT` env var, plus `RATE_LIMIT_CLIENT_HOUR` / `_CLIENT_DAY` / `_GLOBAL_DAY` / `_GLOBAL_MONTH` overrides
- `src/app/robots.ts` — disallows all crawlers
- `/runs` — a public catalog of the newest 15 completed runs, all downloadable, with a report snippet on the newest 5 (`src/server/catalog.ts`); `scripts/db_cleanup.ts` imports its retention constant so listing and retention cannot drift
- `src/server/geocode.ts` — reverse-geocodes each run's coordinates once at creation (Nominatim) so the catalog can name a location instead of printing two numbers
- `Job` columns for what a run was for: `latitude`, `longitude`, `locationName`, `rivers`, `summarized`, `clientHash`
- `report_raw.txt` (`Job.rawFile`) — the crawled source text, kept in both modes so a summarized run can still offer what it was built from
- "Sounder" design system: two hand-built DaisyUI themes (`light`/`dark`), navy chassis with a single olive accent, verified contrast, no shadows, one animation
- `tests/server/scraper.regressions.test.ts` pinning the scraper defects fixed below, plus `catalog.test.ts`, `rateLimit.test.ts`, and a `tests/tsconfig.json` that type-checks the test tree
- `Dockerfile` (4-stage build) and `.dockerignore` for Render deployment
- `docker-compose.yml` with a persistent Postgres volume for local full-stack dev
- `npm run docker:up/down/reset` and `npm run check` commands
- MIT `LICENSE`
- Leaflet marker icons served locally from `public/leaflet/` (removed unpkg CDN dependency)

### Changed
- Unified ShopReel, FishTales, and SiteScout into a single `/api/flybox` pipeline
- Summarization moved from Google Gemini to OpenAI: `gpt-5.6-luna` primary, `gpt-5.6-terra` fallback only after the SDK's retries are exhausted, `reasoning.effort` pinned to `none`, output capped at 6,000 tokens, and an empty response treated as failure
- Aborting and backoff left to the OpenAI SDK's `timeout`/`maxRetries` — the old `Promise.race` timeout billed for requests nobody read
- The search term and summary prompt moved from form fields to server-side constants in `src/server/config.ts`
- Request payload reduced to `{ latitude, longitude, rivers, summarize }`, sent as JSON instead of form data
- The character budget is now split per site (`TOKEN_CHAR_LIMIT / siteCount`, floored at 4,000); one global cap applied twice meant a single greedy site starved every other
- File bytes moved out of the 2s poll into `GET /api/flybox/[id]/files/[name]`, behind an allow-list
- The shop directory is now an option on the form. The shop phase still runs either way — the report phase needs its `fishingReport` flags — so the toggle decides whether the workbook is built and stored
- The updates endpoint reports an `expected` manifest, and readiness only for what is on it. Three files used to auto-download, including `report_raw.txt`, which had no row in the panel and which Chrome was likely blocking as a repeat automatic download
- `rawFile` is written only on summarized runs; in raw mode `primaryFile` already held that text, so every raw run stored up to 500 KB twice
- The panel polls once immediately instead of waiting out the first 2s tick
- Renamed server files: `flybox.ts` → `pipeline.ts`, `scrapingUtils.ts` → `scraper.ts`, `handlers.ts` → `handler.ts`
- Retention windows extracted to `src/server/retention.ts`, which imports nothing: `scripts/db_cleanup.ts` was pulling in ExcelJS and the OpenAI SDK, and the privacy policy was pulling in Prisma, to read three numbers
- `SiteInfo.sellsOnline` and `fishingReport` changed from string to `boolean`; emoji conversion happens at Excel output time only
- `JobMessage` Prisma relation renamed to `jobMessages` (camelCase convention)
- Added `debian-openssl-3.0.x` Prisma binary target for Docker/Render (Ubuntu Noble)
- `useForm.tsx` renamed to `useForm.ts` (no JSX)
- `setup.ts` updated: added `DIRECT_URL` and `RATE_LIMIT_SALT`, removed unused `PORT` and `CONCURRENCY`
- `setup.ts` now appends only the settings missing from `.env` instead of rebuilding the file from a template. The old version carried five named keys across and dropped everything else, so it silently reset `RUN_HEADLESS=false`, discarded `RATE_LIMIT_*` overrides, and turned a double-quoted value into one with the quotes baked in
- Copyright year updated to 2026
- `/privacy-policy` and `/terms-of-service` rewritten to match what the app actually does, including disclosing that the run catalog is public

### Fixed
- Fishing report detection was substring-based, so `/terms-and-conditions` and `/shop/hatchery-supply` read as reports — which was true of nearly every commerce site. Now token-based (`isReportPath()`)
- robots.txt parsing: directive names are lowercased but values are not (rule paths are case-sensitive), plus `*` wildcards, the `$` anchor, inline `#` comments, and consecutive `User-agent` lines as one group
- Email extraction rejects asset lookalikes (`logo@2x.png`) and matches against visible text
- SerpAPI paging stops as soon as a page comes back short instead of paying for all five; a failed request also stops, rather than being read as "no more results"
- Cancel only moves an `IN_PROGRESS` job, so it can no longer overwrite a terminal status
- A run interrupted mid-flight (a deploy, a crash) stayed `IN_PROGRESS` forever: the client polled it indefinitely and no cleanup path would ever match it. Runs now stamp `Job.heartbeatAt` on the cancel check they were already making; a frozen stamp means the run is abandoned, so the next poll reports `FAILED` and `db_cleanup` deletes it
- `Job.clientHash` is cleared once it can no longer affect a limit
- The theme script is an inline `<script>` in `<head>`, not `next/script` with `beforeInteractive`, which was queued into `self.__next_s` and flashed the light theme on every load
- Leaflet helper components moved to module scope; as inner functions they were new component types every render, so React remounted them and re-fired `flyTo`
- Canceled jobs incorrectly showed "Job Complete" badge (`CANCELLED` typo → `CANCELED`)
- Duplicate `<h1>` tags in `error.tsx` and `not-found.tsx`
- Stale output filenames in docs (`simple_shop_details.xlsx` → `report_summary.txt`)
- Relative URL resolution bug in `scrapeShopDetails` anchor parsing
- Ecommerce detection false positives — switched from body text keywords to platform script fingerprints
- Social media detection false positives — filter share buttons, check `hostname.endsWith()`
- Lists are `list-none` throughout, which drops list semantics in WebKit; `role="list"` restores them
- The error and 404 pages had no title of their own

### Removed
- `GEMINI_API_KEY`, the Gemini SDK, and the Gemini terms screenshot from the legal pages
- Decorative emoji (14 of them) and the page-header eyebrows that only repeated the page name
- `scripts/start.sh` (replaced by Docker `CMD`)
- `Justfile` (redundant with npm scripts)
- Three-tool architecture (ShopReel, FishTales, SiteScout)
