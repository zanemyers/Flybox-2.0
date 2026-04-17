# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Flybox is a fly-fishing data aggregation tool built for [Rescue River](https://rescueriver.com). It finds fly-fishing shops via SerpAPI (Google Maps), scrapes their websites for contact info and fishing reports, and summarizes reports with Google Gemini via a single unified pipeline at `/api/flybox`.

## Commands

```bash
npm run dev       # Start dev server (Turbopack)
npm run build     # Build for production
npm run lint      # Run Biome linter (biome check)
npm run format    # Format files (biome format --write)
```

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

Currently deployed on Render using Docker. The `Dockerfile` is a 4-stage build (deps → prod-deps → builder → runner). The runner stage is based on `mcr.microsoft.com/playwright:v1.59.1-noble`, which has Chromium and all system dependencies pre-installed. `RUN_HEADLESS=true` is baked into the image.

**Planned:** Switch to Render's native Node environment (no Docker) to reduce image size. Build command would be `npx prisma migrate deploy && npx playwright install chromium && npm run build`.

For local full-stack testing, `docker-compose.yml` runs both the app and a Postgres container with a named volume (`db_data`). Compose credentials: `postgresql://flybox:flybox@localhost:5432/flybox`.

## Architecture

### Job-Based Async Pattern

1. **Client form** (`flyboxForm.tsx`) → `useForm` hook → `POST /api/flybox`
2. **API route** creates a `Job` in PostgreSQL, fires off the pipeline async, returns `{ jobId }`
3. **Client polls** `GET /api/flybox/[id]/updates` every 2 seconds — `statusPanel.tsx` renders messages and download buttons
4. **Cancel** — `POST /api/flybox/[id]/cancel` sets a DB flag; the pipeline checks `isCanceled()` between steps

### Server Layer (`src/server/`)

Five files, each with a single responsibility:

- **`pipeline.ts`** — `runFlybox()` orchestrates the full job in two phases:
  - *Shop phase*: fetches 5 SerpAPI pages (offsets 0–80), dedupes, concurrently scrapes each shop (robots check → HTTP → Playwright fallback → `scrapeShopDetails`)
  - *Report phase*: filters shops where `fishingReport: true`, dedupes by hostname, crawls each site with a priority queue (BFS, depth-limited), feeds text to Gemini for summarization
  - Gemini primary model: `gemini-2.5-flash`; fallback: `gemini-2.5-flash-lite`. All `generateContent` calls are wrapped in a 60s `Promise.race` timeout to guard against socket-hang bugs on the free tier. 503/UNAVAILABLE errors retry once after 30s before falling back to the lite model; 429/RESOURCE_EXHAUSTED errors use the `retryDelay` from the response (default 120s) with the same 2-attempt limit.
- **`handler.ts`** — `JobHandler` wraps all DB operations (log, save, complete, fail, isCanceled). Also owns `Payload`/`SiteInfo` types, `ExcelFileHandler`, and `TXTFileHandler`. `SiteInfo.sellsOnline` and `fishingReport` are `boolean` — emoji conversion happens only at Excel output time.
- **`scraper.ts`** — HTTP fetching with retries, robots.txt parsing (Allow/Disallow/Crawl-delay), email extraction (mailto → Cloudflare data-cfemail → JSON-LD → body regex → contact page fetch), shop detail detection (ecommerce fingerprints, fishing report path patterns, social media profile links), and URL utilities.
- **`browser.ts`** — Playwright stealth browser wrapper. `needsPlaywright(result)` determines when HTTP fetch is insufficient (blocked, JS-rendered, or null).
- **`db.ts`** — Prisma client singleton with `@prisma/adapter-pg`.

### Database Schema

PostgreSQL via Prisma. Schema in `db/schema.prisma`, generated client in `generated/prisma/`.

- **Job** — `id` (cuid), `status` (IN_PROGRESS | COMPLETED | CANCELED | FAILED), `primaryFile Bytes?` (report summary TXT), `secondaryFile Bytes?` (shop directory XLSX)
- **JobMessage** — progress messages attached to a job (`jobMessages` relation); cascades on delete

All file output is stored as `Bytes` in the DB, never written to disk.

### Non-obvious UI Patterns

- **Submit button outside the form card** — `flyboxForm.tsx` renders `<form id="flybox-form">` and `<button form="flybox-form">` as siblings, so the button sits visually outside the card while still submitting the form.
- **MapInput is SSR-disabled** — dynamically imported with `{ ssr: false }` because Leaflet requires the browser DOM. Marker icons are served from `public/leaflet/` (not a CDN).
- **DaisyUI modal backdrop** — DaisyUI's backdrop uses `form[method=dialog]` which causes nested form errors. Use a `<div onClick>` overlay instead.
- **Theme initialization** — `layout.tsx` runs an inline script before hydration to set `data-theme`. `header.tsx` reads `document.documentElement.getAttribute("data-theme")` on mount rather than re-detecting from `prefers-color-scheme`.

### Styling

Tailwind CSS v4 + DaisyUI v5. Dark mode uses `data-theme` attribute — use `in-data-[theme=dark]:` Tailwind variants (not `dark:`, which uses media queries).

## Environment Variables

```
DATABASE_URL=postgresql://...   # Used by the Prisma client at runtime (supports pooling)
DIRECT_URL=postgresql://...     # Used by Prisma migrations (must be a direct connection)
SERP_API_KEY=...                # SerpAPI key for Google Maps search
GEMINI_API_KEY=...              # Google Gemini API key for summaries
RUN_HEADLESS=true               # Set false to see the Playwright browser
```
