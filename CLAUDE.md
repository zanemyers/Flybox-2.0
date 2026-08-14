# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Flybox is a fly-fishing data aggregation tool built for [Rescue River](https://rescueriver.com). It finds fly-fishing shops via SerpAPI (Google Maps), scrapes their websites for contact info and fishing reports, and summarizes reports with Google Gemini via a single unified pipeline at `/api/flybox`.

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
npx tsx scripts/setup.ts       # Create/update .env with default values
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
  - Gemini primary model: `gemini-2.5-flash`; fallback: `gemini-2.5-flash-lite`. All `generateContent` calls are wrapped in a 60s `Promise.race` timeout to guard against socket-hang bugs on the free tier. 503/UNAVAILABLE and 429/RESOURCE_EXHAUSTED errors retry once (429 honours `retryDelay` from the response, defaulting to 30s) before falling back to the lite model. An **empty** response is treated as failure, not success.
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
DATABASE_URL=postgresql://...   # Used by the Prisma client at runtime (supports pooling)
DIRECT_URL=postgresql://...     # Used by Prisma migrations (must be a direct connection)
RUN_HEADLESS=true               # Set false to see the Playwright browser
```

`scripts/setup.ts` and `docker-compose.yml` also define `SERP_API_KEY` and `GEMINI_API_KEY`, but **no application code reads them** — both keys come from the run form. They are kept as a local scratchpad and as scaffolding for the planned server-side key injection.
