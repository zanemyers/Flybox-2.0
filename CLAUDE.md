# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Flybox is a fly-fishing data aggregation tool built for [Rescue River](https://rescueriver.com). It finds fly-fishing shops via SerpAPI (Google Maps), scrapes their websites for contact info and fishing reports, and summarizes reports with OpenAI via a single unified pipeline at `/api/flybox`.

**Flybox supplies its own API keys.** There is no bring-your-own-key flow. That is the single most important constraint in the codebase: anything a caller can change is something a caller can bill the operator for. The search term and the summary prompt are therefore server-side constants in `src/server/config.ts`, NOT form fields — an editable prompt is a free LLM endpoint, and an editable search term is a general-purpose Maps scraper. Do not move either back onto the client.

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
```

`npm run lint` is Biome only. Biome is not a type checker, so **run `npm run typecheck` too** — or just `npm run check`.

Docker (full-stack local):
```bash
npm run docker:up     # Start Postgres + app via Docker Compose
npm run docker:down   # Stop containers, keep DB volume
npm run docker:reset  # Stop containers and wipe DB volume
```

Prisma:
```bash
npx prisma migrate dev      # Run DB migrations (dev)
npx prisma migrate deploy   # Run DB migrations (prod/Docker)
npx prisma generate         # Regenerate Prisma client (outputs to generated/prisma/)
npx prisma studio           # Open DB browser
```

Setup scripts:
```bash
npx tsx scripts/setup.ts       # Append missing .env settings; never rewrites existing lines
npx tsx scripts/db_cleanup.ts  # Delete old jobs from the database
```

## Deployment

Currently deployed on Render using Docker. The `Dockerfile` is a 4-stage build (deps → prod-deps → builder → runner). The runner stage is based on `mcr.microsoft.com/playwright:v1.62.0-noble`, which has Chromium and all system dependencies pre-installed. `RUN_HEADLESS=true` is baked into the image.

**The runner image tag must track the `playwright` version in `package-lock.json`.** The image ships only the Chromium build that its Playwright release expects; a mismatch fails at launch with `Executable doesn't exist at /ms-playwright/chromium-*`. Bump both together.

The runner also copies `db/` and `prisma.config.ts`, because the documented pre-deploy command is `npx prisma migrate deploy` and that needs the schema.

**Planned:** Switch to Render's native Node environment (no Docker) to reduce image size. Build command would be `npx prisma migrate deploy && npx playwright install chromium && npm run build`.

For local full-stack testing, `docker-compose.yml` runs both the app and a Postgres container with a named volume (`db_data`). Compose credentials: `postgresql://flybox:flybox@localhost:5432/flybox`.

## Architecture

### Job-Based Async Pattern

1. **Client form** (`flyboxForm.tsx`) → `useForm` hook → `POST /api/flybox` as a **JSON body**
2. **API route** validates the payload, creates a `Job` in PostgreSQL, fires off the pipeline async, returns `{ jobId }`. Invalid input gets a 400 with a specific message — it never starts a doomed job.
3. **Client polls** `GET /api/flybox/[id]/updates` every 2 seconds — `statusPanel.tsx` renders messages and the output manifest. The poll response carries `{ message, status, createdAt, files }`, where `files` lists only the **names** that are ready.
4. **Downloads** come from `GET /api/flybox/[id]/files/[name]`, which streams the bytes. File blobs are deliberately kept out of the 2s poll: reading and base64-encoding a several-hundred-KB xlsx every two seconds dominated both the query and the response.
5. **Cancel** — `POST /api/flybox/[id]/cancel` sets a DB flag; the pipeline checks `isCanceled()` between steps *and* inside the crawl loop. Cancel only moves an `IN_PROGRESS` job, so it can't overwrite a terminal status.

### Server Layer (`src/server/`)

Five files, each with a single responsibility:

- **`pipeline.ts`** — `runFlybox()` orchestrates the full job in two phases:
  - *Shop phase*: fetches 5 SerpAPI pages (offsets 0–80), dedupes, concurrently scrapes each shop (robots check → HTTP → Playwright fallback → `scrapeShopDetails`)
  - *Report phase*: filters shops where `fishingReport: true`, dedupes by hostname, crawls each site with a priority queue (BFS, depth-limited), feeds text to Gemini for summarization
  - **Each site gets a share of the prompt budget** (`TOKEN_CHAR_LIMIT / siteCount`, floored at 4k chars). Don't reintroduce a single global cap applied twice — that silently dropped every site after the first.
  - OpenAI primary model: `gpt-5.6-luna`; fallback: `gpt-5.6-terra` (~10x the price, so it must only run after the primary has exhausted the SDK's retries). `max_output_tokens` is capped and `reasoning: { effort: "none" }` is pinned — this is structured extraction, and reasoning tokens bill at the output rate. The SDK's own `timeout` and `maxRetries` handle aborting and backoff; do NOT reintroduce a `Promise.race` timeout, which billed for abandoned requests. An **empty** response is treated as failure, not success.
  - `summarize: false` skips the model entirely and returns the crawled text, with a much larger char budget (`RAW_CHAR_LIMIT`) since there is no prompt to fit.
- **`handler.ts`** — `JobHandler` wraps all DB operations (log, save, complete, fail, isCanceled). Also owns `Payload`/`SiteInfo`, the `OUTPUT_FILES` allow-list, and `buildShopWorkbook()`. `SiteInfo.sellsOnline` and `fishingReport` are `boolean` — emoji conversion happens only at Excel output time. `isCanceled()` caches its answer for 1.5s because it's called per shop and per crawled page.
- **`scraper.ts`** — HTTP fetching with retries, robots.txt parsing, email extraction (mailto → Cloudflare data-cfemail → JSON-LD → visible-text regex → contact page fetch), shop detail detection, and URL utilities.
  - **robots.txt**: directive *names* are lowercased, values are not — rule paths are case-sensitive and so is the URL path. Supports `*` wildcards, the `$` anchor, inline `#` comments, and consecutive `User-agent` lines as one group.
  - **Report detection is token-based, not substring-based.** Substring matching made `/terms-and-conditions` and `/shop/hatchery-supply` read as fishing reports, which was true of nearly every commerce site. See `isReportPath()`.
  - Email candidates are matched against the page's **visible text**, and asset lookalikes (`logo@2x.png`) are rejected.
- **`browser.ts`** — Playwright stealth browser wrapper. `needsPlaywright(result)` determines when HTTP fetch is insufficient (blocked, JS-rendered, or null).
- **`db.ts`** — Prisma client singleton with `@prisma/adapter-pg`.

### Database Schema

PostgreSQL via Prisma. Schema in `db/schema.prisma`, generated client in `generated/prisma/`.

- **Job** — `id` (cuid), `status` (IN_PROGRESS | COMPLETED | CANCELED | FAILED), `createdAt`, `primaryFile Bytes?` (report summary TXT), `secondaryFile Bytes?` (shop directory XLSX)
- **JobMessage** — progress messages attached to a job (`jobMessages` relation); cascades on delete

All file output is stored as `Bytes` in the DB, never written to disk.

## Design System — "Sounder"

The whole visual language lives in `src/client/styles/globals.css`. Read it before styling anything; it is short and every value is deliberate.

- **Two hand-built DaisyUI themes**, `light` and `dark`, declared with `@plugin "daisyui/theme"`. The stock themes are switched off. **The names must stay exactly `light` and `dark`** — the inline theme script in `layout.tsx` and the header toggle both write those strings.
- **Navy** (hue 255) is the chassis: surfaces and ink. **Olive** (hue 112) is the single brand accent, `--color-primary`. State uses `info` / `success` / `warning` / `error`; `success` means COMPLETED.
- **Contrast is verified, not guessed.** Ink is 13–14.5:1 on every surface, the accent 6.3–8.4:1. There is one alpha floor: **nothing below `/70` may carry information** (text or border). `base-content/60` measures 4.12:1 in light and fails AA. Never put alpha on the focus ring.
- **Two hairline tokens, and they are not interchangeable.** `--color-rule` is decorative only (~1.3:1). `--color-stroke` carries every interactive boundary and clears WCAG 1.4.11's 3:1 on all four surfaces a control can sit on. Inputs use `.field`, never `border-base-content/20`.
- **Primitives**: `.shell` (the one page container), `.panel` / `.panel-head` / `.panel-body` (the one card), `.field`, `.chip`, `.eyebrow` (11px tracked mono caps — our labels only, never prose or user data), `.readout` (tabular mono for every number), `.console`, `.well`, `.run-bar`, `.prose-measure`.
- **Flat by construction**: `--depth: 0`, `--noise: 0`, 1px borders, 3–4px radii, no shadows anywhere.
- **One animation app-wide**, `.run-bar`, removed under `prefers-reduced-motion`. It is indeterminate on purpose — the updates endpoint returns no phase or count, so any percentage would be invented.
- Fonts are IBM Plex Sans + IBM Plex Mono via `next/font/google`, wired through `@theme`. Tailwind's preflight picks them up from `--font-sans`/`--font-mono`; don't add a `body { font-family }` override.
- `src/client/components/brand.tsx` holds the only two drawings in the app: `HookMark` and `ContourField`. Utility glyphs come from `react-icons/fi`; brand logos from `react-icons/fa`. **Don't reintroduce decorative emoji** — 14 were removed.

Tailwind CSS v4 + DaisyUI v5. Dark mode is the `data-theme` attribute, so use `in-data-[theme=dark]:` variants (not `dark:`, which uses media queries).

### Non-obvious UI Patterns

- **Submit button outside the form card** — `flyboxForm.tsx` renders `<form id="flybox-form">` and `<button form="flybox-form">` as siblings, so the button sits visually outside the card while still submitting the form.
- **MapInput is SSR-disabled** — dynamically imported with `{ ssr: false }` because Leaflet requires the browser DOM. Marker icons are served from `public/leaflet/` (not a CDN). Its Leaflet helper components (`LocationSelector`, `FlyToLocation`, `ResizeOnShow`) live at **module scope**; as inner functions they were new component types every render, so React remounted them and re-fired `flyTo`.
- **DaisyUI modal backdrop** — DaisyUI's backdrop uses `form[method=dialog]` which causes nested form errors. Use a `<div onClick>` overlay instead.
- **Theme initialization** — `layout.tsx` inlines a plain `<script>` in `<head>` that reads `localStorage.flybox-theme`, falling back to `prefers-color-scheme`. It must **not** become a `next/script` with `beforeInteractive`: that gets queued into `self.__next_s` and runs after first paint, which flashed the light theme on every load. `header.tsx` reads `document.documentElement.getAttribute("data-theme")` on mount rather than re-detecting, and writes the choice back to localStorage.
- **The progress log is written imperatively** (`progressAreaRef.current.textContent`) and is deliberately not a React-rendered list and not an `aria-live` region — it rewrites in full every 2s, so announcing it would flood a screen reader. A separate `sr-only` live region announces state changes instead. Log lines are prefixed with fixed-width ASCII severity tokens (`[..]` `[OK]` `[!!]` `[->]` `[??]`) so severity survives monospace, copy-paste, and screen readers.

## Testing

Vitest, node environment, `tests/**/*.test.ts` (see `vitest.config.ts`). `tests/tsconfig.json` type-checks the test tree, which the root `tsconfig.json` excludes.

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

## The run catalog

`/runs` lists the newest `CATALOG_LIMIT` (15) COMPLETED runs, all downloadable; the newest `DETAILED_RUNS` (5) also show an inline snippet of the report. Both constants live in `src/server/catalog.ts` and are imported by `scripts/db_cleanup.ts`, so retention and display cannot drift apart.

Because every listed run offers downloads, readiness for all 15 is answered with a raw `IS NOT NULL` query rather than by selecting the blobs — selecting them to render a list would pull megabytes. Only the newest 5 have their body read, for the snippet.

`Job` stores the run's `latitude`/`longitude`/`rivers`/`summarized` so the catalog can describe a run after the fact; the payload used to live only in memory. `locationName` is reverse-geocoded **once at job creation** (`src/server/geocode.ts`, Nominatim) — never on render. It is best-effort and null on failure, in which case the page shows coordinates instead.

`rawFile` holds the crawled source text in BOTH modes, so a summarized run can still offer what it was built from. `primaryFile` remains report_summary.txt — the summary when summarized, the raw text otherwise.

**The catalog is public.** Anyone can see the location and download the outputs of any recent run. This is disclosed in the privacy policy; keep it that way if the retention or the listing changes.

## Rate limiting and abuse

`POST /api/flybox` is unauthenticated and every run costs the operator 5 SerpAPI searches, an OpenAI call and a headless browser crawling up to 100 third-party sites. `src/server/rateLimit.ts` enforces per-client and global caps before a job is created. The client is identified by a **salted SHA-256 of its IP**, stored on `Job.clientHash`; the raw address is never stored. Without `RATE_LIMIT_SALT` a per-process salt is generated, so limits reset on redeploy — an unsalted hash of an IPv4 address is trivially reversible, so degrading to that is not acceptable.

`src/app/robots.ts` disallows all crawlers. There is nothing to index and real cost in being crawled.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
