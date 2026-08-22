# Changelog

## [Unreleased]

This section is the net delta since the last release, not a running log — where a
later change superseded an earlier one, only the outcome is listed.

### Added
- A Content-Security-Policy in `src/proxy.ts`, nonce-based so `script-src` can be `'self' 'nonce-…' 'strict-dynamic'` rather than `'unsafe-inline'`. `connect-src` and `img-src` name only the OpenStreetMap origins the map actually uses, and a fetch to anywhere else is blocked. The cost is static rendering: a nonce is per-request, so five previously prerendered pages now render on demand
- Security headers on every response, set in `next.config.ts`: `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy`, and `Strict-Transport-Security`, plus `poweredByHeader: false`. No CSP yet — it needs a nonce pipeline, not a header
- Flybox now supplies its own API keys: no key fields, no account, no bring-your-own-key flow
- `src/server/rateLimit.ts` — per-client (3/hour, 10/day) and global (40/day, 200/30 days) caps, counted from `RunLedger` and recorded in the same locked transaction that admits the run; client identified by a salted SHA-256 of its IP
- `RunLedger` — one row per admitted run and nothing else: a timestamp, plus a `clientHash` cleared at 24h. It exists because `Job` cannot do this job, and it holds no location, payload or outcome, so the global caps count nothing identifying
- `RATE_LIMIT_SALT` env var, plus `RATE_LIMIT_CLIENT_HOUR` / `_CLIENT_DAY` / `_GLOBAL_DAY` / `_GLOBAL_MONTH` overrides
- `src/app/robots.ts` — disallows all crawlers
- `/runs` — a public catalog of the newest 15 completed runs, all downloadable, with a report snippet on the newest 5 (`src/server/catalog.ts`); `scripts/db_cleanup.ts` imports its retention constant so listing and retention cannot drift
- `src/server/geocode.ts` — reverse-geocodes each run's coordinates once at creation (Nominatim) so the catalog can name a location instead of printing two numbers
- `Job` columns for what a run was for: `latitude`, `longitude`, `locationName`, `rivers`, `summarized`, `clientHash`
- `report_raw.txt` (`Job.rawFile`) — the crawled source text, kept in both modes so a summarized run can still offer what it was built from
- "Sounder" design system: two hand-built DaisyUI themes (`light`/`dark`), navy chassis with a single olive accent, verified contrast, no shadows, one animation
- Tests for the defects fixed below: that the rate-limit retention window outlives every window a cap counts over, that `httpFetch` refuses non-markup and caps its reads, and that robots.txt is fetched once per origin rather than once per page
- `tests/server/scraper.regressions.test.ts` pinning the scraper defects fixed below, plus `catalog.test.ts`, `rateLimit.test.ts`, and a `tests/tsconfig.json` that type-checks the test tree
- `docker-compose.yml` running a local Postgres, and `npm run docker:up/down/reset` to drive it
- `npm run check`
- `npm run render:build`, `render:migrate` and `render:cleanup` — Render's build, pre-deploy and cron commands as scripts, so the dashboard holds names rather than chains and a change to any of them shows up in a diff. `render:build` also adds the `prisma generate` step the dashboard command was missing. The cron is named here for one more reason: it is what enforces the retention the privacy policy promises, so it should not exist only in a dashboard
- Migrations moved out of the build and into pre-deploy: a build that fails partway can no longer leave the database ahead of the code, and the build opens no database connection, which makes it safe to run locally
- MIT `LICENSE`
- Leaflet marker icons served locally from `public/leaflet/` (removed unpkg CDN dependency)

### Changed
- Unified ShopReel, FishTales, and SiteScout into a single `/api/flybox` pipeline
- Summarization moved from Google Gemini to OpenAI: `gpt-5.6-luna` primary, `gpt-5.6-terra` fallback only after the SDK's retries are exhausted, `reasoning.effort` pinned to `none`, output capped at 6,000 tokens, and an empty response treated as failure
- Reverse geocoding moved off the request path. It was awaited before the job row was created, so up to 5s of Nominatim latency landed on the user pressing Run; it now starts inside the pipeline alongside the shop phase, which takes minutes
- Aborting and backoff left to the OpenAI SDK's `timeout`/`maxRetries` — the old `Promise.race` timeout billed for requests nobody read
- The search term and summary prompt moved from form fields to server-side constants in `src/server/config.ts`
- Request payload reduced to `{ latitude, longitude, rivers, summarize, shopDirectory }`, sent as JSON instead of form data
- The character budget is now split per site (`TOKEN_CHAR_LIMIT / siteCount`, floored at 4,000); one global cap applied twice meant a single greedy site starved every other
- `getFile` and the poll's readiness map derive their column from `OUTPUT_FILES` instead of restating it, and both are exhaustive over the columns, so a new output is a compile error rather than a file that never reports ready. `getFile`'s old `switch` ended in `default`, which would have served the workbook for anything it did not recognize
- File bytes moved out of the 2s poll into `GET /api/flybox/[id]/files/[name]`, behind an allow-list
- The shop directory is now an option on the form. The shop phase still runs either way — the report phase needs its `fishingReport` flags — so the toggle decides whether the workbook is built and stored
- The updates endpoint reports an `expected` manifest, and readiness only for what is on it. Three files used to auto-download, including `report_raw.txt`, which had no row in the panel and which Chrome was likely blocking as a repeat automatic download
- `rawFile` is written only on summarized runs; in raw mode `primaryFile` already held that text, so every raw run stored up to 500 KB twice
- The panel polls once immediately instead of waiting out the first 2s tick
- Renamed server files: `flybox.ts` → `pipeline.ts`, `scrapingUtils.ts` → `scraper.ts`, `handlers.ts` → `handler.ts`
- Retention windows extracted to `src/server/retention.ts`, which imports nothing: `scripts/db_cleanup.ts` was pulling in ExcelJS and the OpenAI SDK, and the privacy policy was pulling in Prisma, to read three numbers
- `SiteInfo.sellsOnline` and `fishingReport` changed from string to `boolean`; emoji conversion happens at Excel output time only
- `JobMessage` Prisma relation renamed to `jobMessages` (camelCase convention)
- Added `debian-openssl-3.0.x` Prisma binary target for Render (Linux)
- `useForm.tsx` renamed to `useForm.ts` (no JSX)
- `setup.ts` updated: added `DIRECT_URL` and `RATE_LIMIT_SALT`, removed unused `PORT` and `CONCURRENCY`
- `setup.ts` now appends only the settings missing from `.env` instead of rebuilding the file from a template. The old version carried five named keys across and dropped everything else, so it silently reset `RUN_HEADLESS=false`, discarded `RATE_LIMIT_*` overrides, and turned a double-quoted value into one with the quotes baked in
- The footer copyright year is derived from the request rather than hard-coded. Every page is already dynamic for the CSP nonce, so this costs nothing
- `httpFetch` screens on `Content-Type` before reading a body and reads at most 2 MB of it. It also decides `blocked` from a 403/429 status alone and discards that body unread
- The robots.txt cache holds parsed rules rather than raw text, is bounded at 500 origins, expires after 6h, and collapses concurrent misses on one origin into a single request
- Canceling a run uses the same two-press confirm as the form's reset button instead of `window.confirm`, so the app has one destructive-action idiom
- The map's place search reports `Searching…` and disables its button while in flight; the same guard stops held Enter from firing a Nominatim request per keypress
- The status panel's output metadata is exhaustive over `OutputName`, so adding an output is a compile error there rather than a row that throws on render
- `FormState` in the form is `Payload` rather than a structural twin that had to be kept in step with it
- The 404's right column is a sounder readout with no reading — dashes, not zeroes — reusing the `.well` list from `/how-it-works`, so `brand.tsx` stays at two drawings
- Local `.env` points at the docker-compose container again, and `setup.ts` documents that a hosted URL needs `sslmode=verify-full`
- `/privacy-policy` and `/terms-of-service` rewritten to match what the app actually does, including disclosing that the run catalog is public

### Fixed
- Every rate limit was uncountable. The caps counted `Job` rows, which retention deletes on the catalog's schedule — failed and canceled outright, completed past the newest 15 — so each window silently shortened to whatever survived the last prune, and with cleanup on a cron the 200-run monthly cap could never be reached. Counts now come from `RunLedger`, pruned on its own window, and `RATE_LIMIT_WINDOW_MS` is the single constant both the count and the prune read, so evidence cannot again outlive its claim
- The caps were also bypassable by a parallel burst. `checkRateLimit` counted and `JobHandler.create` inserted with nothing in between, so concurrent requests all read the same pre-insert totals and all passed — 25 at once against a 3/hour cap took 25 runs. Admission is now one transaction holding `pg_advisory_xact_lock`, and takes exactly 3
- `complete()` wrote COMPLETED unconditionally, so a cancel arriving inside `isCanceled()`'s 1.5s cache window was overwritten and the run reported success. It now moves only an `IN_PROGRESS` row, which also means a row deleted mid-run no longer throws
- The non-DaisyUI tokens (`--stroke`, `--rule`, `--sunken`, `--mark`, the body gradient) were declared only under `[data-theme]`, so with no attribute they resolved empty and every hairline fell back to `currentColor` — the whole page outlined in full-strength ink. They now sit on `:root`. `prefersdark` came off the dark theme in the same change: it applied DaisyUI's dark colors under a media query while those tokens stayed light, which is how a coherent page became a cream well on a dark panel. The theme script already reads the OS preference before first paint, so it was only ever deciding the no-JS render
- The map dialog had no accessible name, announcing as an unnamed dialog; it is now labelled by its visible heading
- A PDF served from an extensionless URL reached cheerio as binary noise. `BINARY_EXT` screens the pathname, so nothing named like a page was ever checked; the content-type screen catches these by what they are
- `robotsCache` never evicted — a module-level `Map` growing with every origin ever crawled, for the life of the process
- A `robots.txt` carrying only `Crawl-delay` is honored. It has no rules, and the old early return reported a delay of 0 for it
- The per-client rate limit was bypassable. `clientHashFrom` read the leftmost `x-forwarded-for` entry, which is whatever the caller sent, so rotating that header gave a fresh identity per request and left only the global caps — one client could burn the daily allowance and lock everyone else out. The address is now taken by counting in from the right by `RATE_LIMIT_TRUSTED_PROXIES` (default 1), and a count that is too low is detected by the selected address being in a private range
- Fishing report detection was substring-based, so `/terms-and-conditions` and `/shop/hatchery-supply` read as reports — which was true of nearly every commerce site. Now token-based (`isReportPath()`)
- robots.txt parsing: directive names are lowercased but values are not (rule paths are case-sensitive), plus `*` wildcards, the `$` anchor, inline `#` comments, and consecutive `User-agent` lines as one group
- Email extraction rejects asset lookalikes (`logo@2x.png`) and matches against visible text
- SerpAPI paging stops as soon as a page comes back short instead of paying for all five; a failed request also stops, rather than being read as "no more results"
- The fire-and-forget pipeline call discarded every error it caught. `runFlybox` handles its own failures, so anything reaching that catch means the job may be stuck with no trace anywhere; it is now logged with the job id
- Cancel only moves an `IN_PROGRESS` job, so it can no longer overwrite a terminal status
- A run interrupted mid-flight (a deploy, a crash) stayed `IN_PROGRESS` forever: the client polled it indefinitely and no cleanup path would ever match it. Runs now stamp `Job.heartbeatAt` on the cancel check they were already making; a frozen stamp means the run is abandoned, so the next poll reports `FAILED` and `db_cleanup` deletes it
- `Job.clientHash` is cleared once it can no longer affect a limit, and the ledger's own hash is cleared on the same window while its row survives to be counted
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
- The Calvin & Hobbes GIF on the 404 page. Unlicensed: Tenor indexes user uploads, and Watterson licensed no animation, so there was nothing for it to have passed along. The page is otherwise scrupulous about this — `/about` carries the attribution Magnific's license requires
- A no-op cap on the shop list. `paginateShops` already bounds the run to five pages of twenty, so slicing the deduped result to the same product only restated the pagination contract
- `Dockerfile` and `.dockerignore`. Deployment is Render's native Node environment, so no app image was ever built from them; `docker-compose.yml` was the only remaining consumer and now runs Postgres alone. This also retires the constraint that the runner image tag had to track the `playwright` version, and the plan to move off Docker, which had already happened
- `GEMINI_API_KEY`, the Gemini SDK, and the Gemini terms screenshot from the legal pages
- Decorative emoji (14 of them) and the page-header eyebrows that only repeated the page name
- `scripts/start.sh`
- `Justfile` (redundant with npm scripts)
- Three-tool architecture (ShopReel, FishTales, SiteScout)
