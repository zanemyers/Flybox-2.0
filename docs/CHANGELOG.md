# Changelog

## [Unreleased]

### Added
- `Dockerfile` (4-stage build) and `.dockerignore` for Render deployment
- `docker-compose.yml` with a persistent Postgres volume for local full-stack dev
- `npm run docker:up/down/reset` commands
- MIT `LICENSE`
- Leaflet marker icons served locally from `public/leaflet/` (removed unpkg CDN dependency)

### Changed
- Unified ShopReel, FishTales, and SiteScout into a single `/api/flybox` pipeline
- Renamed server files: `flybox.ts` → `pipeline.ts`, `scrapingUtils.ts` → `scraper.ts`, `handlers.ts` → `handler.ts`
- Gemini fallback model switched from `gemini-2.0-flash` (deprecated Jun 2026) to `gemini-2.5-flash-lite`
- Added 60s timeout to all Gemini requests to guard against socket-hang bug on the free tier
- `SiteInfo.sellsOnline` and `fishingReport` changed from string to `boolean`; emoji conversion happens at Excel output time only
- `JobMessage` Prisma relation renamed to `jobMessages` (camelCase convention)
- Added `debian-openssl-3.0.x` Prisma binary target for Docker/Render (Ubuntu Noble)
- `useForm.tsx` renamed to `useForm.ts` (no JSX)
- `setup.ts` updated: added `DIRECT_URL`, removed unused `PORT` and `CONCURRENCY`
- Copyright year updated to 2026

### Fixed
- Canceled jobs incorrectly showed "Job Complete" badge (`CANCELLED` typo → `CANCELED`)
- Duplicate `<h1>` tags in `error.tsx` and `not-found.tsx`
- Stale output filenames in docs (`simple_shop_details.xlsx` → `report_summary.txt`)
- Relative URL resolution bug in `scrapeShopDetails` anchor parsing
- Ecommerce detection false positives — switched from body text keywords to platform script fingerprints
- Social media detection false positives — filter share buttons, check `hostname.endsWith()`

### Removed
- `scripts/start.sh` (replaced by Docker `CMD`)
- `Justfile` (redundant with npm scripts)
- Three-tool architecture (ShopReel, FishTales, SiteScout)
