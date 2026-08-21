# Setup

## Prerequisites

- Node.js 22+
- Docker (for local full-stack dev or deployment)
- A PostgreSQL database (local via Docker Compose, or hosted)
- [SerpAPI key](https://serpapi.com/) — free tier available
- [OpenAI API key](https://platform.openai.com/) — required only when summarizing

Both keys are server-side. Flybox supplies its own and never asks the user for one.

## Local Development

```bash
npm install
npx tsx scripts/setup.ts    # creates .env with default values
npx prisma generate         # generate the Prisma client
npx prisma migrate dev      # run DB migrations
npm run dev                 # start dev server at http://localhost:3000
```

`setup.ts` preserves existing API keys in `.env` on re-runs.

## Environment Variables

| Variable          | Required | Description                                                     |
|-------------------|----------|-----------------------------------------------------------------|
| `DATABASE_URL`    | Yes      | Prisma client at runtime — supports a pooler                    |
| `DIRECT_URL`      | Yes      | Prisma migrations — must be a direct connection                 |
| `SERP_API_KEY`    | Yes      | Every run needs it                                              |
| `OPENAI_API_KEY`  | Sometimes| Only when `summarize` is true                                   |
| `RATE_LIMIT_SALT` | Yes in prod | Keeps client rate-limit hashes stable across restarts        |
| `RUN_HEADLESS`    | No       | Set `false` to watch the Playwright browser work                |

Without `RATE_LIMIT_SALT` a per-process salt is generated, so limits reset on every redeploy. Degrading to an unsalted hash is not an option — an unsalted hash of an IPv4 address is trivially reversible.

Optional rate-limit overrides, with defaults: `RATE_LIMIT_CLIENT_HOUR` (3), `RATE_LIMIT_CLIENT_DAY` (10), `RATE_LIMIT_GLOBAL_DAY` (40), `RATE_LIMIT_GLOBAL_MONTH` (200).

## Docker Compose (full-stack local)

Runs the app and a Postgres container with a persistent volume. Use this to test the full stack before deploying.

```bash
npm run docker:up           # start Postgres + app
npx prisma migrate deploy   # run migrations against the local DB (first time only)
npm run docker:down         # stop containers, keep DB data
npm run docker:reset        # stop containers and wipe DB
```

Start the containers first, then migrate in a second shell once Postgres is accepting connections. Compose credentials are `postgresql://flybox:flybox@localhost:5432/flybox`.

`SERP_API_KEY` and `OPENAI_API_KEY` are passed through from your `.env` file automatically.

## Render Deployment

1. Create a **Web Service** on Render pointed at this repo, with **Docker** as the environment
2. Set `DATABASE_URL`, `DIRECT_URL`, `SERP_API_KEY`, `OPENAI_API_KEY`, and `RATE_LIMIT_SALT` in the Render dashboard
3. Add a **pre-deploy command**: `npx prisma migrate deploy`

`RUN_HEADLESS=true` is baked into the Docker image — no need to set it manually.

The `Dockerfile` is a 4-stage build (deps → prod-deps → builder → runner). The runner is based on `mcr.microsoft.com/playwright:v1.62.0-noble`, which ships Chromium and its system dependencies.

> **The runner image tag must track the `playwright` version in `package-lock.json`.** The image ships only the Chromium build its Playwright release expects; a mismatch fails at launch with `Executable doesn't exist at /ms-playwright/chromium-*`. Bump both together.

The runner also copies `db/` and `prisma.config.ts`, because the pre-deploy command needs the schema.

**Planned:** move to Render's native Node environment to shrink the image, with a build command of `npx prisma migrate deploy && npx playwright install chromium && npm run build`.

## Database Maintenance

```bash
npx tsx scripts/db_cleanup.ts   # delete failed/canceled jobs, and completed runs past the catalog
npx prisma studio               # open DB browser
```

`db_cleanup.ts` reads its windows from `src/server/retention.ts`, so it keeps exactly the runs `/runs` promises to list — currently the newest 15 completed. Everything older, plus every failed or canceled job, is deleted outright, and any run abandoned mid-flight is retired first so it does not linger.

## Checks

```bash
npm run check   # lint + typecheck + tests
```

`npm run lint` is Biome only and does not type-check. Run `npm run typecheck` too, or just `npm run check`.
