# Flybox Overview

Flybox is a fly-fishing data aggregation tool built for [Rescue River](https://rescueriver.com). It finds local fly-fishing shops, identifies which ones publish fishing reports, and summarizes them with Google Gemini — producing a report summary and a shop directory as downloadable files.

## Pipeline

A single run of Flybox executes two sequential phases:

### Shop Phase

1. Fetches up to 100 shops from Google Maps via SerpAPI (5 pages, offsets 0–80)
2. Deduplicates by website/name
3. Concurrently scrapes each shop's website (up to 10 at a time):
   - Checks `robots.txt` — skips disallowed sites, respects `Crawl-delay`
   - HTTP fetch first; falls back to Playwright (stealth Chromium) if blocked or JS-rendered
   - Extracts: email, online store detection, fishing report detection, social media profiles
4. Saves all shops to `shop_details.xlsx`

### Report Phase

1. Filters to shops where `fishingReport: true`
2. Optionally filters further by river name(s)
3. Crawls each shop's site with a BFS priority queue (depth-limited, keyword-prioritized)
4. Feeds crawled text to Google Gemini for summarization
5. Saves the summary to `report_summary.txt`

## Job System

All pipeline runs are tracked as `Job` records in PostgreSQL. The client polls for updates every 2 seconds. Jobs can be canceled mid-run; the pipeline checks between each major step. Output files are stored as `Bytes` in the DB and streamed to the client on completion — nothing is written to disk.

## Tech Stack

| Layer       | Tech                                                                 |
|-------------|----------------------------------------------------------------------|
| Framework   | Next.js (App Router)                                                 |
| Database    | PostgreSQL via Prisma (`@prisma/adapter-pg`)                         |
| Scraping    | Cheerio (HTML parsing) + Playwright (JS-rendered pages)              |
| AI          | Google Gemini (`gemini-2.5-flash`, fallback `gemini-2.5-flash-lite`) |
| Shop search | SerpAPI (Google Maps engine)                                         |
| Styling     | Tailwind CSS v4 + DaisyUI v5                                         |
| Linting     | Biome                                                                |

## Output Files

| File                 | Contents                                                                                   |
|----------------------|--------------------------------------------------------------------------------------------|
| `report_summary.txt` | AI-generated summary of fishing reports found across all shop sites                        |
| `shop_details.xlsx`  | Shop directory with email, address, phone, online store, fishing report flag, social media |
