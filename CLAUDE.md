# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Flybox is a fly-fishing data aggregation tool built for [Rescue River](https://rescueriver.com). It finds fly-fishing shops via SerpAPI (Google Maps) and scrapes their websites for contact info and fishing reports. Those reports are summarized with OpenAI. One unified pipeline does all of it, at `/api/flybox`.

**Flybox supplies its own API keys.** There is no bring-your-own-key flow. That is the single most important constraint in the codebase: anything a caller can change is something a caller can bill the operator for. The search term and the summary prompt are therefore server-side constants in `src/server/config.ts`, NOT form fields. An editable prompt is a free LLM endpoint; an editable search term is a general-purpose Maps scraper. Do not move either back onto the client.

The whole request payload is `{ latitude, longitude, rivers, summarize, shopDirectory }`.

## Commands

```bash
npm run dev        # Start dev server (Turbopack)
npm run build      # Build for production
npm run lint       # Biome lint + format check (does NOT type-check)
npm run format     # Format files (biome format --write)
npm run typecheck  # tsc --noEmit — the only thing that type-checks
npm test           # Vitest (run once); npm run test:watch to watch
npm run check      # lint + typecheck + test, i.e. everything CI should run
npm run render:build    # Render's build command: install, generate, chromium, next build
npm run render:migrate  # Render's pre-deploy command: prisma migrate deploy
npm run render:cleanup  # Render's cron command: prune per src/server/retention.ts
```

`render:build` touches no database, so it is safe to run locally.
`render:migrate` and `render:cleanup` are not — they act on whatever `DIRECT_URL`
and `DATABASE_URL` are in scope, which in a normal `.env` is the hosted database.

`npm run lint` is Biome only. Biome is not a type checker, so **run `npm run typecheck` too** — or just `npm run check`.

`.github/workflows/checks.yml` runs lint, typecheck and test on every PR and every push to `main`.
It touches no database — but it **must** run `npx prisma generate` first, since `generated/` is
gitignored and `src/server/db.ts` imports from it, so typecheck cannot compile without it. That
step is handed a placeholder `DIRECT_URL`: `prisma.config.ts` resolves the variable eagerly at
load and fails without one, even though `generate` only ever reads the schema. Typecheck and the
tests need no database variables at all.

**`biome.json` is strict JSON, so a comment in it is a parse error.** Biome answers a parse error by **silently falling back to its default config** rather than failing. The symptom is Biome suddenly checking 500+ files instead of 58, because every exclude in the file stopped applying.

Local Postgres (the app itself runs on the host):
```bash
npm run docker:up     # Start the Postgres container
npm run docker:down   # Stop it, keep the volume
npm run docker:reset  # Stop it and wipe the volume
```

Prisma:
```bash
npx prisma migrate dev      # Run DB migrations (dev)
npx prisma migrate deploy   # Run DB migrations (prod)
npx prisma generate         # Regenerate Prisma client (outputs to generated/prisma/)
npx prisma studio           # Open DB browser
```

Setup scripts:
```bash
npx tsx scripts/setup.ts       # Append missing .env settings; never rewrites existing lines
npx tsx scripts/db_cleanup.ts  # Prune jobs and the run ledger, each on its own window
```

## Deployment

Deployed on Render's **native Node environment** — there is no Dockerfile and no app image. Chromium comes from `npx playwright install chromium` in the build, so `RUN_HEADLESS` needs no value in production. `browser.ts` reads `process.env.RUN_HEADLESS !== "false"`, so unset means headless.

```
Build:       npm run render:build
Pre-deploy:  npm run render:migrate
Cron:        npm run render:cleanup
Start:       npm start
```

All three live in `package.json`, so the dashboard holds names rather than chains. A change to any of them then shows up in a diff. Migrations are in pre-deploy, not build. A build that fails therefore cannot leave the database ahead of the code, and the build itself never opens a database connection. The cron is named here for the same reason, plus one more. It enforces the retention the privacy policy promises, so it should not exist only in a dashboard.

**`prisma generate` must stay in it.** `generated/` is gitignored and nothing else creates it, while `src/server/db.ts` imports from it. A build without it fails on a clean checkout, and survives only on a warm build cache.

`docker-compose.yml` runs a Postgres container and nothing else, for local development. Credentials: `postgresql://flybox:flybox@localhost:5432/flybox`.

## Architecture

### Job-Based Async Pattern

1. **Client form** (`flyboxForm.tsx`) → `useForm` hook → `POST /api/flybox` as a **JSON body**
2. **API route** validates the payload, creates a `Job` in PostgreSQL, fires off the pipeline async, returns `{ jobId }`. Invalid input gets a 400 with a specific message — it never starts a doomed job.
3. **Client polls** `GET /api/flybox/[id]/updates` every 2 seconds — `statusPanel.tsx` renders messages and the output manifest. The poll response carries `{ message, status, createdAt, expected, files }`. `expected` is the manifest this run promised, decided by its options; `files` is readiness for those names only. The panel renders rows from `expected` and auto-downloads only what `files` reports, so nothing arrives that the caller did not ask for.
4. **Downloads** come from `GET /api/flybox/[id]/files/[name]`, which streams the bytes. File blobs are deliberately kept out of the 2s poll. Reading and base64-encoding a several-hundred-KB xlsx every two seconds dominated both the query and the response.
5. **Cancel** — `POST /api/flybox/[id]/cancel` sets a DB flag; the pipeline checks `isCanceled()` between steps *and* inside the crawl loop. Cancel only moves an `IN_PROGRESS` job, so it can't overwrite a terminal status.

### Server Layer (`src/server/`)

Eleven files, each with a single responsibility. Beyond the six described below: `catalog.ts` (the `/runs` query) and `rateLimit.ts` (per-client and global caps). Then `geocode.ts` (reverse geocoding at job creation) and `config.ts` (the search term, the summary prompt, key access). Also `retention.ts` — how long data lives, importing nothing so `scripts/db_cleanup.ts` can read it without loading the app.

- **`pipeline.ts`** — `runFlybox()` orchestrates the full job in two phases:
  - *Shop phase*: fetches 5 SerpAPI pages (offsets 0–80), dedupes, concurrently scrapes each shop (robots check → HTTP → Playwright fallback → `scrapeShopDetails`)
  - *Report phase*: filters shops where `fishingReport: true`, then dedupes by hostname. Crawls each site with a priority queue (BFS, depth-limited), then feeds the text to OpenAI
  - **Each site gets a share of the prompt budget** (`TOKEN_CHAR_LIMIT / siteCount`, floored at 4k chars). Don't reintroduce a single global cap applied twice — that silently dropped every site after the first.
  - OpenAI primary model: `gpt-5.6-luna`; fallback: `gpt-5.6-terra` (~10x the price, so it must only run after the primary has exhausted the SDK's retries). `max_output_tokens` is capped and `reasoning: { effort: "none" }` is pinned — this is structured extraction, and reasoning tokens bill at the output rate. The SDK's own `timeout` and `maxRetries` handle aborting and backoff; do NOT reintroduce a `Promise.race` timeout, which billed for abandoned requests. An **empty** response is treated as failure, not success.
  - `summarize: false` skips the model entirely and returns the crawled text. The char budget is much larger (`RAW_CHAR_LIMIT`), since there is no prompt to fit.
- **`handler.ts`** — `JobHandler` wraps all DB operations (log, save, complete, fail, isCanceled). Also owns `Payload`/`SiteInfo`, the `OUTPUT_FILES` allow-list, and `buildShopWorkbook()`. `SiteInfo.sellsOnline` and `fishingReport` are `boolean` — emoji conversion happens only at Excel output time. `isCanceled()` caches its answer for 1.5s because it's called per shop and per crawled page.
- **`scraper.ts`** — HTTP fetching with retries, robots.txt parsing, shop detail detection, and URL utilities. Email extraction too, in order: mailto → Cloudflare data-cfemail → JSON-LD → visible-text regex → contact page fetch.
  - **robots.txt**: directive *names* are lowercased, values are not — rule paths are case-sensitive and so is the URL path. Supports `*` wildcards, the `$` anchor, inline `#` comments, and consecutive `User-agent` lines as one group.
  - **Report detection is token-based, not substring-based.** Substring matching made `/terms-and-conditions` and `/shop/hatchery-supply` read as fishing reports, which was true of nearly every commerce site. See `isReportPath()`.
  - Email candidates are matched against the page's **visible text**, and asset lookalikes (`logo@2x.png`) are rejected.
- **`browser.ts`** — Playwright stealth browser wrapper. `needsPlaywright(result)` determines when HTTP fetch is insufficient (blocked, JS-rendered, or null). But **never for a `refused` result** — that is a policy answer a browser would get too.
- **`net.ts`** — `checkUrl()`, the guard on every outbound fetch. **Every URL the crawler visits is chosen by a third party** — SerpAPI hands it shop sites, and it then follows their links. The bytes land in `report_raw.txt`, which the public catalog serves. So a site redirecting to `http://169.254.169.254/` or `http://127.0.0.1:5432` could get the response published. It refuses non-HTTP schemes, local-only names, and any host resolving to a non-public address. And **every** resolved address must be public: one public plus one loopback is the attack, not a partial pass. `httpFetch` uses `redirect: "manual"` and re-checks **each hop** — `redirect: "follow"` walked the chain inside `fetch`, where nothing could see it. Playwright follows redirects internally, so `fetchPage` checks document requests in its `page.route` handler instead. Imports nothing from the app.
  - It does **not** close DNS rebinding: the name is resolved, then `fetch` resolves it again. Pinning the address would mean connecting to the IP with a `Host` header, which `fetch` cannot express.
- **`db.ts`** — Prisma client singleton with `@prisma/adapter-pg`.

### Database Schema

PostgreSQL via Prisma. Schema in `db/schema.prisma`, generated client in `generated/prisma/`.

- **Job** — `id` (cuid), `status` (IN_PROGRESS | COMPLETED | CANCELED | FAILED), `createdAt`, `heartbeatAt` (last proof the pipeline was alive). Then what the run was for: `latitude`, `longitude`, `locationName`, `rivers`, `summarized`, `shopDirectory`. Then the outputs: `primaryFile` (report TXT), `secondaryFile` (shop directory XLSX), `rawFile` (crawled source, summarized runs only). **Nothing identifying lives here** — the rate limiter's IP hash is on `RunLedger` alone, because a Job outlives every window a cap counts over
- **JobMessage** — progress messages attached to a job (`jobMessages` relation); cascades on delete
- **RunLedger** — `id`, `createdAt`, `clientHash`. One row per admitted run and the only thing the rate limiter counts. Holds no location, payload, status or outcome, because the global caps need a timestamp and nothing more. **Pruned by `RATE_LIMIT_WINDOW_MS`, never by the catalog window** — that coupling is exactly what made every cap uncountable.

All file output is stored as `Bytes` in the DB, never written to disk.

## Design System — "Sounder"

The whole visual language lives in `src/client/styles/globals.css`. Read it before styling anything; it is short and every value is deliberate.

- **Two hand-built DaisyUI themes**, `light` and `dark`, declared with `@plugin "daisyui/theme"`. The stock themes are switched off. **The names must stay exactly `light` and `dark`** — the inline theme script in `layout.tsx` and the header toggle both write those strings.
- **Blue leads, cream carries.** In light the ground is cream (hue 90) under deep blue ink (hue 225); in dark the ground is that same blue family (hue 222). `--color-primary` is the brand teal-blue `#0d667a`. `--color-secondary` is salmon and is **fills and marks only** — it measures 3.55:1 on cream, so use `text-mark` whenever salmon has to be text. `--color-accent` is olive. State uses `info` / `success` / `warning` / `error`; `success` means COMPLETED.
- **Contrast is verified, not guessed.** Ink clears 11:1 on every surface. The measured ratio sits beside each value in `globals.css` — read it there rather than restating it here. There is one alpha floor: **nothing below `/70` may carry information** (text or border). `base-content/60` measures 4.12:1 in light and fails AA. Never put alpha on the focus ring.
- **Two hairline tokens, and they are not interchangeable.** `--color-rule` is decorative only (~1.3:1). `--color-stroke` carries every interactive boundary and clears WCAG 1.4.11's 3:1 on all four surfaces a control can sit on. Inputs use `.field`, never `border-base-content/20`.
- **Primitives**: `.shell` (the one page container), `.panel` / `.panel-head` / `.panel-body` (the one card), `.field`, `.chip` (our labels, mono caps), `.tag` (a value the user typed). Then `.eyebrow` (11px tracked mono caps — our labels only, never prose or user data), `.readout` (tabular mono for every number), `.console`, `.well`, `.run-bar`, `.prose-measure`.
- **Flat by construction**: `--depth: 0`, `--noise: 0`, 1px borders, 3–4px radii, no shadows anywhere.
- **One animation app-wide**, `.run-bar`, removed under `prefers-reduced-motion`. It is indeterminate on purpose — the updates endpoint returns no phase or count, so any percentage would be invented.
- Fonts are IBM Plex Sans + IBM Plex Mono via `next/font/google`, wired through `@theme`. Tailwind's preflight picks them up from `--font-sans`/`--font-mono`; don't add a `body { font-family }` override.
- `src/client/components/brand.tsx` holds the only two drawings in the app: `HookMark` and `ContourField`. Utility glyphs come from `react-icons/fi`; brand logos from `react-icons/fa`. **Don't reintroduce decorative emoji** — 14 were removed.

Tailwind CSS v4 + DaisyUI v5. Dark mode is the `data-theme` attribute, so use `in-data-[theme=dark]:` variants (not `dark:`, which uses media queries).

### Non-obvious UI Patterns

- **Submit button outside the form card** — `flyboxForm.tsx` renders `<form id="flybox-form">` and `<button form="flybox-form">` as siblings. The button sits visually outside the card while still submitting the form.
- **MapInput is SSR-disabled** — dynamically imported with `{ ssr: false }` because Leaflet requires the browser DOM. Marker icons are served from `public/leaflet/` (not a CDN). Its Leaflet helper components (`LocationSelector`, `FlyToLocation`, `ResizeOnShow`) live at **module scope**; as inner functions they were new component types every render, so React remounted them and re-fired `flyTo`.
- **DaisyUI modal backdrop** — DaisyUI's backdrop uses `form[method=dialog]` which causes nested form errors. Use a `<div onClick>` overlay instead.
- **The CSP is nonce-based, and that is why every page is dynamic** — `src/proxy.ts` (Next 16's name for middleware; it is **not** `middleware.ts`) mints a nonce per request and puts the policy on both the request and the response. Next reads the nonce back off the *request* header to stamp its own script tags; drop that and the framework's own scripts are what the policy blocks. `layout.tsx` reads `x-nonce` via `headers()` for the theme script, which is ours rather than Next's. That read is what opts every page into dynamic rendering: a nonce cannot be baked into a static page. Five pages stopped being prerendered for this.
- **`style-src-attr 'unsafe-inline'` cannot be tightened while there is a map.** Leaflet positions every tile with an inline `style` attribute; without it the map renders as a broken pile. Script-src stays strict, which is the part that matters.
- **Theme initialization** — `layout.tsx` inlines a plain `<script>` in `<head>` that reads `localStorage.flybox-theme`, falling back to `prefers-color-scheme`. It must **not** become a `next/script` with `beforeInteractive`. That gets queued into `self.__next_s` and runs after first paint, which flashed the light theme on every load. `header.tsx` reads `document.documentElement.getAttribute("data-theme")` on mount rather than re-detecting, and writes the choice back to localStorage.
- **The progress log is written imperatively** (`progressAreaRef.current.textContent`). It is deliberately not a React-rendered list and not an `aria-live` region. It rewrites in full every 2s, so announcing it would flood a screen reader. A separate `sr-only` live region announces state changes instead. Log lines are prefixed with fixed-width ASCII severity tokens (`[..]` `[OK]` `[!!]` `[->]` `[??]`) so severity survives monospace, copy-paste, and screen readers.

## Testing

Vitest, node environment, `tests/**/*.test.ts` (see `vitest.config.ts`). The root `tsconfig.json` excludes `tests/`, so `tests/tsconfig.json` covers that tree — `npm run typecheck` runs both, or a type error in a test survives every check.

There is **no client-side test coverage** — the vitest environment is `node` only and the config's `include` glob does not match `.tsx`. Adding component tests means adding jsdom and widening that glob.

`tests/server/scraper.regressions.test.ts` pins the specific defects fixed on this branch (substring report detection, robots.txt case and wildcard handling). Keep it green.

## Environment Variables

```
DATABASE_URL=postgresql://...   # Prisma client at runtime (supports pooling)
DIRECT_URL=postgresql://...     # Prisma migrations (must be a direct connection)
SERP_API_KEY=...                # REQUIRED — every run needs it
OPENAI_API_KEY=...              # Required only when summarize is true
RUN_HEADLESS=true               # Set false to see the Playwright browser
RATE_LIMIT_SALT=...             # Keeps client rate-limit hashes stable across restarts
```

Optional rate-limit overrides, with defaults: `RATE_LIMIT_CLIENT_HOUR` (3), `RATE_LIMIT_CLIENT_DAY` (10), `RATE_LIMIT_GLOBAL_DAY` (40), `RATE_LIMIT_GLOBAL_MONTH` (200). The monthly default is sized against a 1,000-search SerpAPI plan at 5 searches per run.

`RATE_LIMIT_TRUSTED_PROXIES` (1) is not a tuning knob like the others. It is how many proxies sit in front of the app, and it decides which `x-forwarded-for` entry is believed. Too high and a caller can forge an identity per request, retiring the per-client caps; too low and every caller shares one limit. Both directions log a warning on the first request that shows them.

## The run catalog

`/runs` lists the newest `CATALOG_LIMIT` (15) COMPLETED runs, all downloadable; the newest `DETAILED_RUNS` (5) also show an inline snippet of the report. Both constants live in `src/server/catalog.ts` and are imported by `scripts/db_cleanup.ts`, so retention and display cannot drift apart.

Every listed run offers downloads. Readiness for all 15 is therefore answered with a raw `IS NOT NULL` query rather than by selecting the blobs. Selecting them to render a list would pull megabytes. Only the newest 5 have their body read, for the snippet.

`Job` stores the run's `latitude`/`longitude`/`rivers`/`summarized` so the catalog can describe a run after the fact; the payload used to live only in memory. `locationName` is reverse-geocoded **once per run, in the pipeline** (`src/server/geocode.ts`, Nominatim) — never on render, and never on the request path. It is started alongside the shop phase, since up to 5s of Nominatim latency used to land on the POST. It is best-effort and null on failure, in which case the page shows coordinates instead.

`rawFile` holds the crawled source text on summarized runs ONLY, so such a run can still offer what it was built from. Raw mode does not write it, because `primaryFile` already is that text there. Storing it twice cost a second copy of up to 500 KB. `primaryFile` remains report_summary.txt — the summary when summarized, the raw text otherwise.

**The catalog is public.** Anyone can see the location and download the outputs of any recent run. This is disclosed in the privacy policy; keep it that way if the retention or the listing changes.

## Rate limiting and abuse

`POST /api/flybox` is unauthenticated. Every run costs the operator 5 SerpAPI searches, an OpenAI call, and a headless browser crawling up to 100 third-party sites. `src/server/rateLimit.ts` counts and records a run in one locked transaction before the job is created. **Counts come from `RunLedger`, never from `Job`.** Retention deletes `Job` rows on the catalog's schedule. Counting them shortened every cap to whatever survived the last prune, monthly cap included. `RATE_LIMIT_WINDOW_MS` in `retention.ts` is read by both the count and the prune, so they cannot drift again. Admission holds `pg_advisory_xact_lock`: counting then inserting let a parallel burst bypass the caps entirely. The client is identified by a **salted SHA-256 of its IP** on `RunLedger.clientHash`; the raw address is never stored. That IP is read by **counting in from the right** of `x-forwarded-for`. Each proxy appends the peer it heard from, so the rightmost entries are infrastructure's; anything further left may have been typed by the caller. Reading the leftmost, the usual "client IP" convention, made the header a free identity. Without `RATE_LIMIT_SALT` a per-process salt is generated, so limits reset on redeploy. That is the right trade: an unsalted hash of an IPv4 address is trivially reversible.

Downloads are capped too, but differently: `allowDownload()` is **in memory**, per client, 60/minute (`RATE_LIMIT_DOWNLOADS_MINUTE`). A run costs API credits and must be counted durably, or a restart refunds it. A download costs a blob read and bandwidth: worth bounding, not worth a DB write per request. `/runs` publishes the job ids that address the download route, so without a cap the blobs were an open pipe. The 2s poll also reads at most `MAX_LOG_LINES` (500) messages, newest first — it had no ceiling at all. `/api/flybox/[id]/updates` is deliberately **not** capped. Legitimate polling is 30 requests a minute per open panel, so a cap tight enough to matter would break it.

`src/app/robots.ts` disallows all crawlers. There is nothing to index and real cost in being crawled.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
