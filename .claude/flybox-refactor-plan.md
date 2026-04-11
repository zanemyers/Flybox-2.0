# Plan: Unify ShopReel + SiteScout + FishTales into a Single "Flybox" Tool

## Context

Currently, the app has three separate tools requiring sequential manual steps:
1. ShopReel → finds shops, exports Excel
2. SiteScout → merges shop URLs into FishTales starter file
3. FishTales → crawls & summarizes reports

Users have to download files and re-upload them between tools. The goal is a single form that runs the full pipeline automatically: find shops → identify report URLs → crawl & summarize. The three individual tools will be removed entirely.

No FishTales starter file required — the pipeline builds its own site list from SerpAPI results.

---

## Target Folder Structure

```
src/
  app/                          # Next.js App Router (pages + API routes)
  server/                       # All server-only code
    pipeline/                   # Core business logic
      flybox.ts                 # FlyboxPipeline extends BaseTask — orchestrator
      shopPhase.ts              # Phase 1: SerpAPI search + shop scraping
      crawlPhase.ts             # Phase 3: crawl + Gemini summarization
      types.ts                  # FlyboxPayload + shared pipeline types
    baseTask.ts                 # (moved from lib/base/)
    baseAPI.ts                  # (moved from lib/base/)
    browser.ts                  # (renamed from stealthBrowser.ts)
    fileUtils.ts                # (moved from lib/base/)
    scrapingUtils.ts            # (moved from lib/base/)
    flyboxApi.ts                # FlyboxAPI extends BaseAPI
    db.ts                       # (moved from lib/)
    constants.ts                # (moved from lib/base/)
    types/                      # (moved from lib/base/types/)
  client/
    components/
    hooks/
    theme/
```

---

## Files to Create

| File                                       | Purpose                                              |
|--------------------------------------------|------------------------------------------------------|
| `src/server/pipeline/flybox.ts`            | FlyboxPipeline extends BaseTask — orchestrator only  |
| `src/server/pipeline/shopPhase.ts`         | Phase 1: SerpAPI search + shop scraping              |
| `src/server/pipeline/crawlPhase.ts`        | Phase 3: priority queue crawl + Gemini summarization |
| `src/server/pipeline/types.ts`             | FlyboxPayload interface + shared pipeline types      |
| `src/server/flyboxApi.ts`                  | FlyboxAPI extends BaseAPI                            |
| `src/app/api/flybox/route.ts`              | POST /api/flybox                                     |
| `src/app/api/flybox/[id]/updates/route.ts` | GET polling                                          |
| `src/app/api/flybox/[id]/cancel/route.ts`  | POST cancel                                          |
| `src/app/flybox/form.tsx`                  | Form component (rendered by home page)               |

## Files to Move/Rename

| From                               | To                            |
|------------------------------------|-------------------------------|
| `src/lib/base/baseTask.ts`         | `src/server/baseTask.ts`      |
| `src/lib/base/baseAPI.ts`          | `src/server/baseAPI.ts`       |
| `src/lib/base/stealthBrowser.ts`   | `src/server/browser.ts`       |
| `src/lib/base/fileUtils.ts`        | `src/server/fileUtils.ts`     |
| `src/lib/base/scrapingUtils.ts`    | `src/server/scrapingUtils.ts` |
| `src/lib/base/constants.ts`        | `src/server/constants.ts`     |
| `src/lib/base/types/`              | `src/server/types/`           |
| `src/lib/db.ts`                    | `src/server/db.ts`            |

## Files to Delete

- `src/app/shopReel/`
- `src/app/fishTales/`
- `src/app/siteScout/`
- `src/app/api/shopReel/`
- `src/app/api/fishTales/`
- `src/app/api/siteScout/`
- `src/lib/` (entire folder — everything moved or deleted)
- `src/app/docs/docInfo/fishTales.tsx` (and shopReel/siteScout equivalents)

## Files to Modify

| File                                       | Change                                            |
|--------------------------------------------|---------------------------------------------------|
| `db/schema.prisma`                         | Remove `JobType` enum and `type` field from `Job` |
| `src/client/components/layout/navbar.tsx`  | Replace 3 nav links with single `/flybox` link    |
| `src/app/page.tsx`                         | Replace with form (home page = the tool)          |
| `src/app/docs/`                            | Update or remove docs for individual tools        |

---

## DB Migration

Remove the `JobType` enum and `type` field from the `Job` model entirely — there's only one job type now so it adds no value.

Then run: `npx prisma migrate dev --name remove-job-type`

---

## FlyboxPipeline Task

### `src/server/pipeline/types.ts`
Shared types only — no logic:
```typescript
export interface FlyboxPayload {
  serpApiKey: string
  geminiApiKey: string
  searchTerm: string      // default: "Fly Fishing Shops"
  lat: number
  lng: number
  maxAge: number          // default: 100 days
  filterByRivers: boolean
  riverList: string[]
  summaryPrompt: string
}
```

Hardcoded constants (not user-configurable):
- `tokenLimit`: 50000
- `crawlDepth`: 15
- `maxResults`: 100
- `model`: `"gemini-3-flash"`

### `src/server/pipeline/shopPhase.ts`
Phase 1 logic extracted from `shopReel.ts`:
- Query SerpAPI (paginated fetch)
- Scrape each shop concurrently with `PromisePool` (concurrency 5) + `StealthBrowser`
- Extract: emails, `sellsOnline`, `fishingReport` flag, social media
- Returns `ShopResult[]` (all shops for Excel + filtered list for Phase 3)

### `src/server/pipeline/flybox.ts`
`FlyboxPipeline extends BaseTask` — orchestrator only, delegates to phase files:
- **Phase 1**: calls `shopPhase.ts` → shop list
- **Phase 2** (inline, simple): dedup shop URLs by domain using `sameDomain()` → `SiteInfo[]`
- **Phase 3**: calls `crawlPhase.ts` → summaries

### `src/server/pipeline/crawlPhase.ts`
Phase 3 logic extracted from `fishTales.ts`:
- Priority queue crawler (TinyQueue) — `selector` is optional, not needed here
- Starting URLs from Phase 2 shop homepages
- Filter by `maxAge` + optional river keywords
- Chunk text → concurrent Gemini summarization → merge summaries

### Output Files
- `primaryFile`: `report_summary.txt`
- `secondaryFile`: `shop_details.xlsx` (full shop details Excel)

---

## FlyboxAPI (`src/server/flyboxApi.ts`)

`class FlyboxAPI extends BaseAPI`

**handleCreateJob(req)**:
- Parse FormData: all fields from FlyboxPayload
- Create `Job` with `status: IN_PROGRESS`
- Instantiate `FlyboxPipeline` and call `pipeline.run()` async (fire-and-forget)
- Return `{ jobId, status }` (201)

**getFiles(job)**:
- Return `[{ name: "report_summary.txt", buffer: job.primaryFile }, { name: "shop_details.xlsx", buffer: job.secondaryFile }]`

---

## Unified Form (`src/app/flybox/form.tsx`)

Layout: both sections wrapped in the `BaseForm` inner panel style (matching current ShopReel tab content style).

**Basic Inputs:**
- SerpAPI Key (password)
- Gemini API Key (password)
- Search Term (default: "Fly Fishing Shops")
- Latitude + Longitude (with MapInput modal) — same `grid grid-cols-[1fr_1fr_auto]` layout as ShopReel

**Advanced Settings (`<details>`):**
- Max Report Age (default: 100)
- Filter by Rivers toggle + conditional River Names text input
- Summary Prompt (textarea)

**Validation:** serpApiKey, geminiApiKey, searchTerm, lat/lng ranges, maxAge minimum, riverList if filterByRivers.

**Submission:** `useForm("flybox")` — same polling + auto-download pattern as existing tools.

---

## Navigation Update

In `src/client/components/layout/navbar.tsx`:
- Remove all tool links (ShopReel, FishTales, SiteScout)
- Keep logo linking to `/` (home = the form)
- Keep "Docs" and "About" links

---

## Key Utilities to Reuse (Do Not Duplicate)

| Utility            | New Location                         | Used For                  |
|--------------------|--------------------------------------|---------------------------|
| `PromisePool`      | npm package                          | Concurrent scraping       |
| `StealthBrowser`   | `src/server/browser.ts`              | Playwright scraping       |
| `ExcelFileHandler` | `src/server/fileUtils.ts`            | Shop details output       |
| `TXTFileHandler`   | `src/server/fileUtils.ts`            | Report summary output     |
| `sameDomain()`     | `src/server/scrapingUtils.ts`        | URL dedup                 |
| `GoogleGenAI`      | `@google/genai`                      | Gemini summarization      |
| `TinyQueue`        | npm package                          | Priority queue crawling   |
| `BaseTask`         | `src/server/baseTask.ts`             | Job management            |
| `BaseAPI`          | `src/server/baseAPI.ts`              | Route handling            |
| `useForm`       | `src/client/hooks/useForm.tsx`           | Form submission + polling |
| `MapInput`         | `src/client/components/inputs/mapInput.tsx` | Location picker           |

---

## Implementation Order

1. Move/rename `lib/base/` → `server/` and `lib/db.ts` → `server/db.ts` (update all imports)
2. DB migration (replace JobType enum with FLYBOX only)
3. Create `pipeline/types.ts`
4. Create `pipeline/shopPhase.ts` (extract from shopReel.ts)
5. Create `pipeline/crawlPhase.ts` (extract from fishTales.ts)
6. Create `pipeline/flybox.ts` (orchestrator)
7. Create `server/flyboxApi.ts`
8. Create API routes under `app/api/flybox/`
9. Create `app/flybox/form.tsx` + update `app/page.tsx` to render it
10. Update navbar
11. Delete old tool files, routes, and `src/lib/`

---

## Verification

1. `npm run dev` — confirm no import errors
2. Open `/flybox` — form renders with all fields
3. Submit with valid SerpAPI + Gemini keys + a US location
4. StatusPanel shows messages from all three phases
5. On completion: `report_summary.txt` and `shop_details.xlsx` auto-download
6. Old routes `/shopReel`, `/fishTales`, `/siteScout` return 404
7. `npm run build` — no TypeScript errors
