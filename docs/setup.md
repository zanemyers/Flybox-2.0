# Setup

## Prerequisites

- Node.js 22+
- Docker (optional — only to run the local Postgres container)
- A PostgreSQL database (local via `docker compose`, or hosted)
- [SerpAPI key](https://serpapi.com/) — free tier available
- [OpenAI API key](https://platform.openai.com/) — required only when summarizing

Both keys are server-side. Flybox supplies its own and never asks the user for one.

## Local Development

```bash
npm install
npx tsx scripts/setup.ts    # add any missing .env settings
npx prisma generate         # generate the Prisma client
npx prisma migrate dev      # run DB migrations
npm run dev                 # start dev server at http://localhost:3000
```

`setup.ts` only appends what is missing. Re-running it never rewrites or removes a line, so keys you set by hand — `RUN_HEADLESS=false`, a `RATE_LIMIT_*` override — survive.

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

`RATE_LIMIT_TRUSTED_PROXIES` (1) is not a tuning knob like the others: it is how many proxies sit in front of the app, and it decides which `x-forwarded-for` entry is believed. Too high and a caller can forge an identity per request, retiring the per-client caps; too low and every caller shares one limit. Both directions log a warning on the first request that shows them.

## Local Postgres

`docker-compose.yml` runs a Postgres container and nothing else — the app itself runs on the host with `npm run dev`.

```bash
npm run docker:up           # start the container
npx prisma migrate deploy   # migrate once it is accepting connections
npm run docker:down         # stop it, keep the data
npm run docker:reset        # stop it and wipe the volume
```

Credentials are `postgresql://flybox:flybox@localhost:5432/flybox`, which is what `scripts/setup.ts` writes into `.env` by default.

## Render Deployment

Render's **native Node environment** — no Docker, no image.

1. Create a **Web Service** pointed at this repo, with **Node** as the environment
2. Set `DATABASE_URL`, `DIRECT_URL`, `SERP_API_KEY`, `OPENAI_API_KEY`, and `RATE_LIMIT_SALT`
3. Build command: `npm run render:build`
4. Pre-deploy command: `npm run render:migrate`
5. Start command: `npm start`

Both are npm scripts so the dashboard holds names instead of chains, and so a
change to either shows up in a diff:

```
render:build    npm install && npx prisma generate && npx playwright install chromium && npm run build
render:migrate  npx prisma migrate deploy
```

Migrations sit in pre-deploy rather than in the build for two reasons: a build
that fails partway cannot leave the database ahead of the code it was migrating
for, and the build opens no database connection at all, which makes
`npm run render:build` safe to run on a dev machine.

> **`prisma generate` has to stay in it.** `generated/` is gitignored and nothing
> else produces it, but `src/server/db.ts` imports from it. Leave it out and the
> build fails on any clean checkout — it will appear to work for as long as
> Render's build cache still holds a `generated/` from a previous deploy.

> **`npm run render:migrate` is not a local command.** It migrates whatever
> `DIRECT_URL` is in scope, and in a normal `.env` that is the hosted database. To
> migrate a local database, set the local URLs explicitly on the command.

`npx playwright install chromium` downloads the browser but not system libraries;
`--with-deps` needs root, which the build does not have. It works on Render's
current build image, so a Playwright upgrade that wants a newer system library is
the thing to watch.

`RUN_HEADLESS` needs no value in production. `browser.ts` reads
`process.env.RUN_HEADLESS !== "false"`, so unset means headless.

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
