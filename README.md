# <img src="src/app/icon.svg" alt="Flybox Logo" width="30" style="vertical-align: middle;"/> Flybox

Tools built for **[Rescue River](https://rescueriver.com/)** to find fly-fishing shops, scrape their sites for fishing reports, and summarize them with OpenAI. Live site: **https://flybox.zm1.org**

## What It Does

Pick a location on the map, optionally filter by river, and press run. Flybox searches Google Maps for fly-fishing shops and scrapes contact info and fishing reports. You get a summarized report plus a shop directory, both downloadable. No API keys or account required — Flybox supplies its own, and runs are rate limited.

Recent runs are listed publicly at `/runs`, where anyone can download their outputs — see the [privacy policy](src/app/privacy-policy/page.tsx).

## Quick Start

You need Node 22+, a PostgreSQL database, a [SerpAPI key](https://serpapi.com/), and — only if you want summaries — an [OpenAI key](https://platform.openai.com/). Both keys are server-side.

```bash
npm install
npx tsx scripts/setup.ts       # add any missing .env settings
npx prisma generate            # generate the Prisma client
npx prisma migrate dev         # run DB migrations
npm run dev                    # start dev server (Turbopack)
```

No Postgres handy? `npm run docker:up` starts one in a container, and the app still runs on the host.

[Setup](docs/setup.md) covers the environment variables, the local database and the Render
deployment in full. This section is only meant to get a dev server up.

## Checks

```bash
npm run check   # lint + typecheck + tests
```

Biome does not type-check, so `npm run lint` alone is not enough. On a clean checkout
`npm run typecheck` also needs `npx prisma generate` and `npx next typegen` to have run — both
write gitignored files that `tsconfig.json` depends on. See [Setup](docs/setup.md#checks).

## Docs

- [Overview](docs/overview.md) — pipeline, job system, rate limits, tech stack
- [Setup](docs/setup.md) — local dev, environment variables, local Postgres, Render deployment
- [IDE](docs/ide.md) — extensions and editor configuration
- [Changelog](docs/CHANGELOG.md)

`CLAUDE.md` is the agent-facing companion: the invariants and non-obvious patterns behind the
code, rather than a second description of it.

## License

MIT — see [LICENSE](LICENSE)
