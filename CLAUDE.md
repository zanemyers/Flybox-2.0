# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

It is deliberately **not** a description of the app — `docs/overview.md` is that, and `docs/setup.md`
owns every setup, environment and deployment mechanic. What lives here is the part that cannot be
recovered by reading the code: the constraints, and the things that were tried and broke.

| Looking for | Read |
|---|---|
| How the pipeline, job system, catalog and rate limits work | `docs/overview.md` |
| Env vars, local Postgres, Render deployment, checks | `docs/setup.md` |
| Editor and extension configuration | `docs/ide.md` |
| Why the code is the way it is, and what not to undo | this file |

## Project Overview

Flybox is a fly-fishing data aggregation tool built for [Rescue River](https://rescueriver.com). It finds fly-fishing shops via SerpAPI (Google Maps) and scrapes their websites for contact info and fishing reports. Those reports are summarized with OpenAI. One unified pipeline does all of it, at `/api/flybox`.

**Flybox supplies its own API keys.** There is no bring-your-own-key flow. That is the single most important constraint in the codebase: anything a caller can change is something a caller can bill the operator for. The search term and the summary prompt are therefore server-side constants in `src/server/config.ts`, NOT form fields. An editable prompt is a free LLM endpoint; an editable search term is a general-purpose Maps scraper. Do not move either back onto the client.

The whole request payload is `{ latitude, longitude, rivers, summarize, shopDirectory }`.

## Commands

```bash
npm run dev        # Start dev server (Turbopack)
npm run build      # Build for production
npm run lint       # Biome lint + format check (does NOT type-check)
npm run format     # Format files (biome format --write)
npm run typecheck  # tsc --noEmit, over src/ and tests/
npm test           # Vitest (run once); npm run test:watch to watch
npm run check      # lint + typecheck + test, i.e. everything CI runs
npm run docker:up  # Local Postgres container; :down keeps the volume, :reset wipes it
npm run render:build    # Render's build command: install, generate, chromium, next build
npm run render:migrate  # Render's pre-deploy command: prisma migrate deploy
npm run render:cleanup  # Render's cron command: prune per src/server/retention.ts
```

```bash
npx prisma migrate dev      # DB migrations (dev); migrate deploy for prod
npx prisma generate         # Regenerate Prisma client (outputs to generated/prisma/)
npx prisma studio           # Open DB browser
npx tsx scripts/setup.ts    # Append missing .env settings; never rewrites existing lines
npx tsx scripts/db_cleanup.ts  # Prune jobs and the run ledger, each on its own window
```

**`render:migrate` and `render:cleanup` are not local commands.** They act on whatever `DIRECT_URL`
and `DATABASE_URL` are in scope, which in a normal `.env` is the hosted database. `render:build`
touches no database and is safe to run locally.

**`npm run typecheck` cannot pass on a clean checkout.** It needs `npx prisma generate` (for
`generated/prisma`, which `src/server/db.ts` imports) and `npx next typegen` (for `next-env.d.ts`,
which `tsconfig.json` includes and the image imports resolve through). Both outputs are gitignored,
and no check regenerates them for you. `npm run lint` is Biome only and is not a type checker.

**Deployment is Render's native Node environment — there is no Dockerfile and no app image.** One
was deleted; don't reintroduce one. `prisma generate` must stay in `render:build`: without it a
clean checkout fails and only a warm build cache hides it.

**`biome.json` is strict JSON, so a comment in it is a parse error.** Biome answers a parse error by **silently falling back to its default config** rather than failing. The symptom is Biome suddenly checking 500+ files instead of 58, because every exclude in the file stopped applying.

## Invariants

Each of these was a defect once. `docs/overview.md` explains the designs; this is what not to undo.

**`pipeline.ts`**
- **Each site gets a share of the prompt budget** (`TOKEN_CHAR_LIMIT / siteCount`, floored at 4k chars). Don't reintroduce a single global cap applied twice — that silently dropped every site after the first.
- The OpenAI fallback (`gpt-5.6-terra`) is ~10x the primary's price, so it must only run after the primary has exhausted the SDK's retries. `reasoning: { effort: "none" }` is pinned and `max_output_tokens` capped — this is structured extraction, and reasoning tokens bill at the output rate.
- The SDK's own `timeout` and `maxRetries` handle aborting and backoff. Do NOT reintroduce a `Promise.race` timeout, which billed for abandoned requests. An **empty** response is treated as failure, not success.
- The shop phase is never skipped. `shopDirectory: false` decides whether the workbook is built, not whether shops are searched — the report phase filters on the `fishingReport` flags that phase sets.

**`scraper.ts`**
- **Report detection is token-based, not substring-based.** Substring matching made `/terms-and-conditions` and `/shop/hatchery-supply` read as fishing reports, which was true of nearly every commerce site. See `isReportPath()`.
- **robots.txt**: directive *names* are lowercased, values are not — rule paths are case-sensitive and so is the URL path. Supports `*` wildcards, the `$` anchor, inline `#` comments, and consecutive `User-agent` lines as one group. Fetched once per origin, not once per page.
- Email extraction order is mailto → Cloudflare `data-cfemail` → JSON-LD → visible-text regex → contact page. Candidates are matched against the page's **visible text**, and asset lookalikes (`logo@2x.png`) are rejected.

**`net.ts`** — the guard on every outbound fetch, and it imports nothing from the app.
- **Every URL the crawler visits is chosen by a third party**, and the bytes land in `report_raw.txt`, which the public catalog serves. So a site redirecting to `http://169.254.169.254/` or `http://127.0.0.1:5432` could get the response published.
- **Every** resolved address must be public: one public plus one loopback is the attack, not a partial pass.
- `httpFetch` uses `redirect: "manual"` and re-checks **each hop** — `redirect: "follow"` walked the chain inside `fetch`, where nothing could see it. Playwright follows redirects internally, so `fetchPage` checks document requests in its `page.route` handler instead.
- It does **not** close DNS rebinding: the name is resolved, then `fetch` resolves it again. Pinning the address would mean connecting to the IP with a `Host` header, which `fetch` cannot express.

**`browser.ts`** — `needsPlaywright(result)` decides when an HTTP fetch was insufficient (blocked, JS-rendered, or null). But **never for a `refused` result** — that is a policy answer a browser would get too.

**`handler.ts`** — `SiteInfo.sellsOnline` and `fishingReport` are `boolean`; emoji conversion happens only at Excel output time. `isCanceled()` caches its answer for 1.5s because it is called per shop and per crawled page.

**Catalog and limits**
- Readiness for the listed runs is answered with a raw `IS NOT NULL` query rather than by selecting the blobs; selecting them to render a list pulled megabytes. Only the newest `DETAILED_RUNS` have their body read, for the snippet.
- `rawFile` holds the crawled source on summarized runs ONLY. Raw mode does not write it, because `primaryFile` already is that text there — storing it twice cost a second copy of up to 500 KB.
- **`RunLedger` is pruned by `RATE_LIMIT_WINDOW_MS`, never by the catalog window.** That coupling is exactly what made every cap uncountable, monthly included.
- `locationName` is reverse-geocoded once per run **in the pipeline**, never on render and never on the request path — up to 5s of Nominatim latency used to land on the POST.
- `/api/flybox/[id]/updates` is deliberately **not** rate-capped: legitimate polling is 30 requests a minute per open panel, so a cap tight enough to matter would break it. The poll reads at most `MAX_LOG_LINES` (500) messages, where it had no ceiling at all.
- **The catalog is public.** Anyone can see the location and download the outputs of any recent run. This is disclosed in the privacy policy; keep it that way if the retention or the listing changes.

## Database Schema

PostgreSQL via Prisma. Schema in `db/schema.prisma`, generated client in `generated/prisma/`.

- **Job** — `id` (cuid), `status` (IN_PROGRESS | COMPLETED | CANCELED | FAILED), `createdAt`, `heartbeatAt` (last proof the pipeline was alive). Then what the run was for: `latitude`, `longitude`, `locationName`, `rivers`, `summarized`, `shopDirectory`. Then the outputs: `primaryFile` (report TXT), `secondaryFile` (shop directory XLSX), `rawFile` (crawled source, summarized runs only). **Nothing identifying lives here** — the rate limiter's IP hash is on `RunLedger` alone, because a Job outlives every window a cap counts over
- **JobMessage** — progress messages attached to a job (`jobMessages` relation); cascades on delete
- **RunLedger** — `id`, `createdAt`, `clientHash`. One row per admitted run and the only thing the rate limiter counts. Holds no location, payload, status or outcome, because the global caps need a timestamp and nothing more

All file output is stored as `Bytes` in the DB, never written to disk.

## Design System — "Sounder"

The whole visual language lives in `src/client/styles/globals.css`. Read it before styling anything; it is short and every value is deliberate.

- **Two hand-built DaisyUI themes**, `light` and `dark`, declared with `@plugin "daisyui/theme"`. The stock themes are switched off. **The names must stay exactly `light` and `dark`** — the inline theme script in `layout.tsx` and the header toggle both write those strings.
- **Blue leads, cream carries.** In light the ground is cream (hue 90) under deep blue ink (hue 225); in dark the ground is that same blue family (hue 222). `--color-primary` is the brand teal-blue `#0d667a`. `--color-secondary` is salmon and is **fills and marks only** — it measures 3.55:1 on cream, so use `text-mark` whenever salmon has to be text. `--color-accent` is olive. State uses `info` / `success` / `warning` / `error`; `success` means COMPLETED.
- **Contrast is verified, not guessed.** Ink clears 11:1 on every surface. The measured ratio sits beside each value in `globals.css` — read it there rather than restating it here. There is one alpha floor: **nothing below `/70` may carry information** (text or border). `base-content/60` measures 4.12:1 in light and fails AA. Never put alpha on the focus ring.
- **Two hairline tokens, and they are not interchangeable.** `--color-rule` is decorative only (~1.3:1). `--color-stroke` carries every interactive boundary and clears WCAG 1.4.11's 3:1 on all four surfaces a control can sit on. Inputs use `.field`, never `border-base-content/20`.
- **Primitives**: `.shell` (the one page container), `.panel` / `.panel-head` / `.panel-body` (the one card), `.field`, `.chip` (our labels, mono caps), `.tag` (a value the user typed). Then `.eyebrow` (11px tracked mono caps — our labels only, never prose or user data), `.readout` (tabular mono for every number), `.console`, `.well`, `.run-bar`, `.prose-measure`.
- **Flat by construction**: `--depth: 0`, `--noise: 0`, 1px borders, 3–4px radii, no shadows anywhere.
- **One animation app-wide**, `.run-bar`, removed under `prefers-reduced-motion`. It is indeterminate on purpose — the updates endpoint returns no phase or count, so any percentage would be invented.
- Fonts are IBM Plex Sans + IBM Plex Mono via `next/font/google`, wired through `@theme`. Tailwind's preflight picks them up from `--font-sans`/`--font-mono`; don't add a `body { font-family }` override.
- `src/client/components/brand.tsx` holds the only two drawings in the app: `HookMark` and `ContourField`. Utility glyphs come from `react-icons/fi`; brand logos from `react-icons/fa`. **Don't reintroduce decorative emoji** — 14 were removed.

Tailwind CSS v4 + DaisyUI v5. Dark mode is the `data-theme` attribute, so use `in-data-[theme=dark]:` variants (not `dark:`, which uses media queries).

### Non-obvious UI Patterns

- **Submit button outside the form card** — `flyboxForm.tsx` renders `<form id="flybox-form">` and `<button form="flybox-form">` as siblings. The button sits visually outside the card while still submitting the form.
- **MapInput is SSR-disabled** — dynamically imported with `{ ssr: false }` because Leaflet requires the browser DOM. Marker icons are served from `public/leaflet/` (not a CDN). Its Leaflet helper components (`LocationSelector`, `FlyToLocation`, `ResizeOnShow`) live at **module scope**; as inner functions they were new component types every render, so React remounted them and re-fired `flyTo`.
- **DaisyUI modal backdrop** — DaisyUI's backdrop uses `form[method=dialog]` which causes nested form errors. Use a `<div onClick>` overlay instead.
- **The CSP is nonce-based, and that is why every page is dynamic** — `src/proxy.ts` (Next 16's name for middleware; it is **not** `middleware.ts`) mints a nonce per request and puts the policy on both the request and the response. Next reads the nonce back off the *request* header to stamp its own script tags; drop that and the framework's own scripts are what the policy blocks. `layout.tsx` reads `x-nonce` via `headers()` for the theme script, which is ours rather than Next's. That read is what opts every page into dynamic rendering: a nonce cannot be baked into a static page. Five pages stopped being prerendered for this.
- **`style-src-attr 'unsafe-inline'` cannot be tightened while there is a map.** Leaflet positions every tile with an inline `style` attribute; without it the map renders as a broken pile. Script-src stays strict, which is the part that matters.
- **Theme initialization** — `layout.tsx` inlines a plain `<script>` in `<head>` that reads `localStorage.flybox-theme`, falling back to `prefers-color-scheme`. It must **not** become a `next/script` with `beforeInteractive`. That gets queued into `self.__next_s` and runs after first paint, which flashed the light theme on every load. `header.tsx` reads `document.documentElement.getAttribute("data-theme")` on mount rather than re-detecting, and writes the choice back to localStorage.
- **The progress log is written imperatively** (`progressAreaRef.current.textContent`). It is deliberately not a React-rendered list and not an `aria-live` region. It rewrites in full every 2s, so announcing it would flood a screen reader. A separate `sr-only` live region announces state changes instead. Log lines are prefixed with fixed-width ASCII severity tokens (`[..]` `[OK]` `[!!]` `[->]` `[??]`) so severity survives monospace, copy-paste, and screen readers.

## Testing

Vitest, node environment, `tests/**/*.test.ts` (see `vitest.config.ts`).

- The root `tsconfig.json` excludes `tests/`, so `tests/tsconfig.json` covers that tree and `npm run typecheck` runs both — otherwise a type error in a test survives every check.
- There is **no client-side test coverage**: the environment is `node` only and the `include` glob does not match `.tsx`. Adding component tests means adding jsdom and widening that glob.
- `tests/server/scraper.regressions.test.ts` pins the scraper defects that have been fixed (substring report detection, robots.txt case and wildcard handling). Keep it green.
- `tests/hookmark.test.ts` reads `brand.tsx` and `app/icon.svg` as **text**, because the hook is drawn in both and they cannot be one file — the component needs `currentColor`, the favicon needs literal colors and `prefers-color-scheme`. It pins the geometry they share.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
