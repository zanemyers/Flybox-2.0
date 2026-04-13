# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Flybox is a fly-fishing data aggregation tool built for [Rescue River](https://rescueriver.com). It finds fly-fishing shops via SerpAPI (Google Maps), scrapes their websites for contact info and fishing reports, and summarizes reports with Google Gemini. All three original tools (ShopReel, FishTales, SiteScout) are being merged into a single unified pipeline at `/api/flybox`.

## Commands

```bash
npm run dev       # Start dev server (Turbopack)
npm run build     # Build for production
npm run lint      # Run Biome linter (biome check)
npm run format    # Format files (biome format --write)
```

Prisma:
```bash
npx prisma migrate dev    # Run DB migrations
npx prisma generate       # Regenerate Prisma client (outputs to generated/prisma/)
npx prisma studio         # Open DB browser
```

Setup scripts:
```bash
npx ts-node scripts/setup.ts       # Initialize DB
npx ts-node scripts/db_cleanup.ts  # Clean up old jobs
```

## Architecture

### Job-Based Async Pattern

1. **Client form** (`flyboxForm.tsx`) → `useForm` hook → `POST /api/flybox`
2. **API route** creates a `Job` in PostgreSQL, fires off the pipeline async, returns `{ jobId }`
3. **Client polls** `GET /api/flybox/[id]/updates` every second — `statusPanel.tsx` renders messages and download buttons
4. **Cancel** — `POST /api/flybox/[id]/cancel` sets a DB flag; the pipeline checks `isCanceled()` between steps

### Layer Structure

```
src/
  app/                        # Next.js App Router pages + API routes
    api/flybox/               # POST (create job), [id]/updates (poll), [id]/cancel
    docs/tabs/                # Doc tab components (flybox, geminiApi, serpApi)
  client/
    components/               # flyboxForm, statusPanel, mapInput, docs, header
    hooks/useForm.tsx          # Form submit → job creation + localStorage persistence
    images/                   # Static assets (about/, docs/, gif, png)
    styles/globals.css
  server/
    baseAPI.ts                # Abstract class: standard job CRUD
    baseTask.ts               # Abstract class: logMessage(), setFile(), isCanceled()
    browser.ts                # Playwright stealth wrapper
    constants.ts              # ERRORS, MESSAGES, FALLBACK_DETAILS, JobStatus, regexes
    db.ts                     # Prisma client singleton (PrismaPg adapter)
    fileUtils.ts              # In-memory ExcelFileHandler / TXTFileHandler
    flyboxApi.ts              # FlyboxAPI extends BaseAPI (stub)
    scrapingUtils.ts          # Cheerio/Playwright scraping helpers
    pipeline/                 # Unified pipeline implementation (stub)
      flybox.ts               # Main pipeline orchestrator
      shopPhase.ts            # SerpAPI search + shop scraping phase
      crawlPhase.ts           # Fishing report crawl + Gemini summarization phase
      types.ts                # Pipeline-specific types
    types/
      componentTypes.ts       # TocItem, DocSectionProps, ListItems, ListBlockProps
      formState.ts            # PreservedEnv, ApiFile
      taskTypes.ts            # Job/task type definitions
  _deprecated/                # Old three-tool code kept for reference during migration
```

### Non-obvious UI patterns

- **Submit button outside the form card** — `flyboxForm.tsx` renders the dark `<form id="flybox-form">` card and the submit `<button form="flybox-form">` as siblings, so the button sits visually outside the card while still triggering form submission.
- **MapInput is SSR-disabled** — dynamically imported with `{ ssr: false }` because Leaflet requires the browser DOM.
- **DaisyUI modal backdrop** — DaisyUI's backdrop uses `form[method=dialog]` which causes nested form errors. Use a `<div onClick>` overlay instead.
- **Theme initialization** — `layout.tsx` runs an inline script before hydration to set `data-theme`. `header.tsx` reads `document.documentElement.getAttribute("data-theme")` on mount rather than re-detecting from `prefers-color-scheme`.

### Database Schema

PostgreSQL via Prisma with `@prisma/adapter-pg`. Schema in `db/schema.prisma`, generated client in `generated/prisma/`.

- **Job** — `id` (cuid), `type` (SHOP_REEL | FISH_TALES | SITE_SCOUT), `status` (IN_PROGRESS | COMPLETED | CANCELED | FAILED), `primaryFile Bytes?`, `secondaryFile Bytes?`
- **JobMessage** — progress messages attached to a job; cascades on delete

All file output (Excel, text) is stored as `Bytes` in the DB, never written to disk.

### Styling

Tailwind CSS v4 + DaisyUI v5. Dark mode uses `data-theme` attribute — use `in-data-[theme=dark]:` Tailwind variants (not `dark:`, which uses media queries).

## Environment Variables

```
DATABASE_URL=postgresql://...
SERP_API_KEY=...        # SerpAPI key for Google Maps search
GEMINI_API_KEY=...      # Google Gemini API key for summaries
RUN_HEADLESS=true       # Set false to see the Playwright browser
```
