# <img src="src/app/favicon.ico" alt="Flybox Logo" width="30" style="vertical-align: middle;"/> Flybox

Tools built for **[Rescue River](https://rescueriver.com/)** to find fly-fishing shops, scrape their sites for fishing reports, and summarize them with Google Gemini. Live site: **https://flybox.zm1.org**

## What It Does

Enter a location and your API keys — Flybox searches Google Maps for fly-fishing shops, scrapes contact info and fishing report links, and produces a summarized report plus a shop directory as downloadable files.

## Requirements

- **SerpAPI key** — for Google Maps shop search
- **Gemini API key** — for fishing report summarization
- **PostgreSQL database** — for job tracking

## Local Development

```bash
npm install
npx tsx scripts/setup.ts       # creates .env with default values
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

`SERP_API_KEY` and `GEMINI_API_KEY` are passed through from your `.env` file, but no
application code reads them — Flybox takes both keys from the run form.

## Deployment (Render)

1. Create a **Web Service** on Render pointed at this repo, with **Docker** as the environment
2. Set environment variables in the Render dashboard:
   - `DATABASE_URL` — supports a connection pooler
   - `DIRECT_URL` — must be a direct connection (used by Prisma migrations)
3. Add a **pre-deploy command**: `npx prisma migrate deploy`

The API keys are supplied per run through the form, so they are not deployment
environment variables.

> The runner image tag in the `Dockerfile` must match the `playwright` version in
> `package-lock.json` — the image only ships the Chromium build that release expects.

## Checks

```bash
npm run check   # lint + typecheck + tests
```

`npm run lint` is Biome only and does not type-check; `npm run typecheck` runs `tsc`.

## License

MIT — see [LICENSE](LICENSE)
