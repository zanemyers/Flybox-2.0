# <img src="src/app/favicon.ico" alt="Flybox Logo" width="30" style="vertical-align: middle;"/> Flybox

Tools built for **[Rescue River](https://rescueriver.com/)** to find fly-fishing shops, scrape their sites for fishing reports, and summarize them with OpenAI. Live site: **https://flybox.zm1.org**

## What It Does

Pick a location on the map, optionally filter by river, and press run. Flybox searches Google Maps for fly-fishing shops, scrapes contact info and fishing reports, and produces a summarized report plus a shop directory as downloadable files. No API keys or account required — Flybox supplies its own, and runs are rate limited.

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

## Docker (full-stack local)

Spins up the app and a Postgres container with a persistent volume:

```bash
npm run docker:up      # start Postgres + app
npm run docker:down    # stop (keeps DB data)
npm run docker:reset   # stop and wipe DB
```

Start the containers first, then migrate against the running database:

```bash
npm run docker:up                 # in one shell
npx prisma migrate deploy         # in another, once Postgres is accepting connections
```

`SERP_API_KEY` and `OPENAI_API_KEY` are passed through from your `.env` file and are
read at runtime — Flybox supplies its own keys and never asks the user for one.

## Deployment (Render)

1. Create a **Web Service** on Render pointed at this repo, with **Docker** as the environment
2. Set environment variables in the Render dashboard:
   - `DATABASE_URL` — supports a connection pooler
   - `DIRECT_URL` — must be a direct connection (used by Prisma migrations)
   - `SERP_API_KEY`, `OPENAI_API_KEY`, `RATE_LIMIT_SALT`
3. Add a **pre-deploy command**: `npx prisma migrate deploy`

Both API keys are server-side, so they must be set in the deployment environment.
Set `RATE_LIMIT_SALT` too, or client rate limits reset on every deploy.

> The runner image tag in the `Dockerfile` must match the `playwright` version in
> `package-lock.json` — the image only ships the Chromium build that release expects.

## Checks

```bash
npm run check   # lint + typecheck + tests
```

`npm run lint` is Biome only and does not type-check; `npm run typecheck` runs `tsc`.

## Docs

- [Overview](docs/overview.md) — pipeline, job system, rate limits, tech stack
- [Setup](docs/setup.md) — local dev, Docker Compose, Render deployment
- [IDE](docs/ide.md) — extensions and editor configuration
- [Changelog](docs/CHANGELOG.md)

## License

MIT — see [LICENSE](LICENSE)
