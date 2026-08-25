# <img src="src/app/favicon.ico" alt="Flybox Logo" width="30" style="vertical-align: middle;"/> Flybox

Tools built for **[Rescue River](https://rescueriver.com/)** to find fly-fishing shops, scrape their sites for fishing reports, and summarize them with OpenAI. Live site: **https://flybox.zm1.org**

## What It Does

Pick a location on the map, optionally filter by river, and press run. Flybox searches Google Maps for fly-fishing shops and scrapes contact info and fishing reports. You get a summarized report plus a shop directory, both downloadable. No API keys or account required — Flybox supplies its own, and runs are rate limited.

Recent runs are listed publicly at `/runs`, where anyone can download their outputs — see the [privacy policy](src/app/privacy-policy/page.tsx).

## Requirements

- **SerpAPI key** — for Google Maps shop search (server-side)
- **OpenAI API key** — for fishing report summarization (server-side; optional if you only use raw-text mode)
- **PostgreSQL database** — for job tracking

## Local Development

```bash
npm install
npx tsx scripts/setup.ts       # add any missing .env settings
npx prisma migrate dev         # run DB migrations
npm run dev                    # start dev server (Turbopack)
```

## Local Postgres

`docker-compose.yml` runs a Postgres container and nothing else — the app runs on the host.

```bash
npm run docker:up      # start it
npm run docker:down    # stop (keeps data)
npm run docker:reset   # stop and wipe the volume
```

Then migrate once it is accepting connections:

```bash
npx prisma migrate deploy
```

`SERP_API_KEY` and `OPENAI_API_KEY` are read at runtime from `.env` — Flybox
supplies its own keys and never asks the user for one.

## Deployment (Render)

Native Node environment, no Docker.

```
Build:       npm run render:build     # install, prisma generate, chromium, next build
Pre-deploy:  npm run render:migrate   # prisma migrate deploy
Cron:        npm run render:cleanup   # prune per src/server/retention.ts
Start:       npm start
```

Migrations are in pre-deploy, so a failed build cannot leave the database ahead of
the code. The cron is what enforces the retention the privacy policy promises, so it
is named here rather than living only in the dashboard. `render:migrate` and
`render:cleanup` both target whatever `DIRECT_URL` and `DATABASE_URL` are in scope —
neither is a local command.

Environment variables: `DATABASE_URL` (supports a pooler), `DIRECT_URL` (direct
connection, used by migrations), `SERP_API_KEY`, `OPENAI_API_KEY`, and
`RATE_LIMIT_SALT` — without the salt, client rate limits reset on every deploy.

`RATE_LIMIT_TRUSTED_PROXIES` (default 1) is not a tuning knob: it is how many proxies
sit in front of the app, and it decides which `x-forwarded-for` entry is believed. Too
high and a caller can forge an identity per request, retiring the per-client caps; too
low and every caller shares one limit. Both directions log a warning on the first
request that shows them.

> `prisma generate` must stay in that chain. `generated/` is gitignored and nothing
> else creates it, so a build without it fails on a clean checkout.

## Checks

```bash
npm run check   # lint + typecheck + tests
```

`npm run lint` is Biome only and does not type-check; `npm run typecheck` runs `tsc`.

`.github/workflows/checks.yml` runs the same three on every pull request and every push to
`main`, as separate steps so a red run says which one failed. It needs no database: `prisma
generate` is given a placeholder `DIRECT_URL` because `prisma.config.ts` resolves one at load,
and every test that touches Prisma mocks it.

## Docs

- [Overview](docs/overview.md) — pipeline, job system, rate limits, tech stack
- [Setup](docs/setup.md) — local dev, local Postgres, Render deployment
- [IDE](docs/ide.md) — extensions and editor configuration
- [Changelog](docs/CHANGELOG.md)

## License

MIT — see [LICENSE](LICENSE)
