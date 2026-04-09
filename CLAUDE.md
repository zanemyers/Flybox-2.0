# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Flybox is a fly-fishing data aggregation tool built for [Rescue River](https://rescueriver.com). It has three tools:

- **ShopReel** — Searches Google Maps (via SerpAPI) for fly-fishing shops and scrapes their websites for contact info, online shop presence, and fishing report links
- **FishTales** — Crawls configured fishing report websites, extracts report text, and summarizes with Google Gemini
- **SiteScout** — Compares ShopReel output against a FishTales starter file and appends missing shop URLs

## Commands

```bash
npm run dev       # Start dev server
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

All three tools share the same flow:

1. **Client form** → submits via `useJobForm` hook → POST to `/api/{tool}`
2. **API handler** creates a `Job` in PostgreSQL, kicks off an async task, returns job ID
3. **Client polls** `/api/{tool}/{jobId}/updates` — `progressPanel` component shows messages and download buttons
4. **Cancel** — POST to `/api/{tool}/{jobId}/cancel` sets a cancellation flag; tasks check `BaseTask.isCanceled()` between steps

### Layer Structure

```
app/                    # Next.js App Router pages + API routes
lib/
  base/
    baseAPI.ts          # Abstract class — provides standard CRUD endpoints for jobs
    baseTask.ts         # Abstract class — DB helpers: logMessage(), setFile(), isCanceled()
    stealthBrowser.ts   # Playwright wrapper with stealth plugins and anti-bot randomization
    fileUtils.ts        # In-memory TXTFileHandler and ExcelFileHandler (no filesystem writes)
    constants.ts        # Shared error strings, job statuses, fallback data, regexes
  api/
    shopApi.ts          # ShopReelAPI extends BaseAPI
    fishApi.ts          # FishTalesAPI extends BaseAPI
    siteApi.ts          # SiteScoutAPI extends BaseAPI
  tasks/
    shop_reel/shopReel.ts    # ShopReel extends BaseTask — SerpAPI search + Playwright scraping
    fish_tales/fishTales.ts  # FishTales extends BaseTask — crawler + Gemini summarization
    site_scout/siteScout.ts  # SiteScout extends BaseTask — URL comparison and merge
hooks/
  useJobForm.tsx        # Handles form submit, job creation, localStorage persistence
  useFormState.tsx      # Tool-specific form state
  useLocalStorage.tsx   # Persists job ID across page reloads
components/
  sections/             # progressPanel, baseForm, instructionPanel, etc.
  inputs/               # textInput, fileInput, checkBoxInput, mapInput, etc.
```

### Database Schema

PostgreSQL via Prisma with `@prisma/adapter-pg`. Schema in `db/schema.prisma`, migrations in `db/migrations/`, generated client in `generated/prisma/`.

- **Job** — `id`, `type` (SHOP_REEL | FISH_TALES | SITE_SCOUT), `status` (IN_PROGRESS | COMPLETED | CANCELED | FAILED), `primaryFile Bytes`, `secondaryFile Bytes`
- **JobMessage** — progress messages attached to a job; cascades on delete

All file output (Excel, text) is stored as `Bytes` in the DB, never written to disk.

### Styling

Tailwind CSS v4 + DaisyUI v5 for components. Panda CSS is used for the design token system (`theme/` → `styled-system/` generated output).

## Environment Variables

```
DATABASE_URL=postgresql://...
SERP_API_KEY=...        # SerpAPI key for Google Maps search
GEMINI_API_KEY=...      # Google Gemini API key for FishTales summaries
RUN_HEADLESS=true       # Set false to see the Playwright browser during ShopReel
```