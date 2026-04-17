# Setup

## Prerequisites

- Node.js 22+
- Docker (for local full-stack dev or deployment)
- A PostgreSQL database (local via Docker Compose, or hosted)
- [SerpAPI key](https://serpapi.com/) — free tier available
- [Gemini API key](https://ai.google.dev/aistudio) — free tier available

## Local Development

```bash
npm install
npx tsx scripts/setup.ts    # creates .env with default values
npx prisma migrate dev      # run DB migrations
npm run dev                 # start dev server at http://localhost:3000
```

`setup.ts` preserves existing API keys in `.env` on re-runs.

## Docker Compose (full-stack local)

Runs the app and a Postgres container with a persistent volume. Use this to test the full stack before deploying.

```bash
npm run docker:up           # start Postgres + app
npx prisma migrate deploy   # run migrations against the local DB (first time only)
npm run docker:down         # stop containers, keep DB data
npm run docker:reset        # stop containers and wipe DB
```

`SERP_API_KEY` and `GEMINI_API_KEY` are passed through from your `.env` file automatically.

## Render Deployment

1. Create a **Web Service** on Render pointed at this repo, with **Docker** as the environment
2. Set these environment variables in the Render dashboard:

| Variable         | Description                                              |
|------------------|----------------------------------------------------------|
| `DATABASE_URL`   | Connection string — supports a pooler                    |
| `DIRECT_URL`     | Direct connection string — required by Prisma migrations |
| `SERP_API_KEY`   | SerpAPI key                                              |
| `GEMINI_API_KEY` | Gemini API key                                           |

3. Add a **pre-deploy command**: `npx prisma migrate deploy`

`RUN_HEADLESS=true` is baked into the Docker image — no need to set it manually.

## Database Maintenance

```bash
npx tsx scripts/db_cleanup.ts   # delete failed/canceled jobs; keep 5 most recent completed
npx prisma studio               # open DB browser
```
