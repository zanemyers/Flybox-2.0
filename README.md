# <img src="src/app/favicon.ico" alt="Flybox Logo" width="30" style="vertical-align: middle;"/> Flybox

Tools built for **[Rescue River](https://rescueriver.com/)** to find fly-fishing shops, scrape their sites for fishing reports, and summarize them with Google Gemini. Live site: **https://flybox.zm1.org**

## What It Does

Enter a location and your API keys — Flybox searches Google Maps for fly-fishing shops, scrapes contact info and fishing report links, and produces a summarized report plus a shop directory as downloadable files.

## Requirements

- **SerpAPI key** — for Google Maps shop search
- **Gemini API key** — for fishing report summarization
- **PostgreSQL database** — for job tracking

## Setup

1. Copy `.env.example` to `.env` and fill in the values
2. `npm install`
3. `npx prisma migrate dev`
4. `npx ts-node scripts/setup.ts`
5. `npm run dev`
