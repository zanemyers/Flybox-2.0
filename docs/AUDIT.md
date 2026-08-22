# Production Readiness Audit

**Snapshot:** 2026-08-21, last revised against `32f647d` on `redesign/tailwater`.
**Scope:** all of `src/`, `scripts/`, `db/`, plus `next.config.ts`, `biome.json`, `tsconfig.json` — about 5,200 lines.

This is a working list, not reference documentation. It goes stale as items are
fixed; check the commit above before trusting any line of it. When an item is
done, delete it rather than marking it done — the changelog is where finished
work belongs.

State of the tree: `npm run check` green (Biome clean, `tsc` clean, 169 server
tests passing), no `any`, no non-null assertions, `strict` on, no dead exports.
Note that green here is measured on macOS and against a local Postgres; it says nothing about a Render build.

---

## Production risks

### 1. The per-client rate limit is bypassable

`src/server/rateLimit.ts:79`

`clientHashFrom` takes the **leftmost** `x-forwarded-for` entry. That header is
client-supplied and proxies append to it, so a caller who sends
`X-Forwarded-For: 1.2.3.4` and rotates the value gets a fresh identity on every
request. The 3/hour and 10/day per-client caps stop applying, leaving only the
global caps — so one attacker can burn the entire 40/day global allowance and
lock out every real user.

The operator's wallet is still protected by the global caps. Availability is not.

**Fix:** count from the right — the entry the proxy itself appended — rather than
the left. The correct index depends on how many proxies Render puts in front of
the app, so verify against a real request's headers before committing to a rule.
Do not simply prefer `x-real-ip`; a client can send that too, and whether the
proxy overwrites it needs checking.

### 2. No Content-Security-Policy

`next.config.ts`

Everything else on this front is done — `X-Content-Type-Options`,
`Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy`,
`Strict-Transport-Security`, and `poweredByHeader: false`.

A CSP is the piece left, and it is its own project: it needs a nonce pipeline
rather than a static header, because Next streams inline scripts of its own, the
theme script in `layout.tsx` must run before first paint, and Leaflet writes
inline `style` attributes.

Origin inventory, already worked out: tiles from
`https://*.tile.openstreetmap.org` (`img-src`), the map search box hitting
`https://nominatim.openstreetmap.org` (`connect-src`), fonts self-hosted under
`/_next` by `next/font` (`font-src 'self'`). `frame-ancestors`, `base-uri` and
`form-action` could land first at low risk, ahead of the script-src work.

Note that dev and production differ here — `next dev` needs `'unsafe-eval'` for
HMR — so a policy that passes locally is not evidence it passes in production.

---

## Cleanliness

### 3. `OUTPUT_FILES` is re-encoded by hand

`src/server/handler.ts:205` and the readiness map above it

`getUpdates` builds its readiness map by naming each output and its column again,
and `getFile` switches over the same mapping a third time, rather than iterating
`OUTPUT_FILES`. Adding a fourth output means editing three places.

Left deliberately once, on 2026-08-21: collapsing `getFile`'s switch needs a
dynamic `select` key, which Prisma cannot type, so it trades three explicit
branches for a cast in a codebase that currently has none. Worth doing only if a
fourth output actually arrives, or if someone finds a way to iterate
`OUTPUT_FILES` that stays type-safe.

The rest of what this item used to list is done: the dead `Job`/`JobMessage`
re-exports in `db.ts`, the "two fixed outputs" docstring on the files route, the
ES2017 `tsconfig` target, and the missing `catalog.ts` tiebreaker.

## Checked and ruled out

- **`/runs` is not statically cached.** `export const dynamic = "force-dynamic"`
  is present (`runs/page.tsx:11`).
- **The browser-direct OpenStreetMap call is disclosed.** The privacy policy
  covers both the server-side lookup and the map search box running from the
  user's browser, including the IP exposure. The residual concern is only
  operational: that call sends no identifying `User-Agent`, unlike
  `geocode.ts`, so it is the path most likely to get rate-limited by Nominatim.
- **No unhandled rejection from the fire-and-forget pipeline**, and it is no
  longer silent — the `.catch` in `route.ts` logs with the job id.
- **The lockfile's missing `@emnapi/runtime` and `@emnapi/core` entries do not
  affect deploys.** They break `npm ci`, which only the deleted Dockerfile ran;
  the Render build uses `npm install`, which resolves them. They are needed by
  the wasm32 fallbacks `@img/sharp-wasm32` and `@tailwindcss/oxide-wasm32-wasi`,
  not by the Linux `sharp` binaries — all sixteen of those are in the lockfile.
  Worth a lockfile regeneration eventually, but it blocks nothing.

---

## Suggested order

1. Item **1** — the only exploitable one left, and the only remaining production risk.
2. Items **2, 3** — hardening and cleanup. The CSP is the largest thing left.

**Carried, not a risk:** Render's build and pre-deploy fields still hold the raw
command chains. `npx prisma generate` has been added to the build, so nothing is
broken; switching the two fields to `npm run render:build` and
`npm run render:migrate` is planned for when `redesign/tailwater` merges.

## Fixed and removed from this list

All on 2026-08-21. The changelog carries the detail.

- Abandoned `IN_PROGRESS` runs living forever — now a `heartbeatAt` stamp, retired on poll and by `db_cleanup`
- A third file auto-downloading with no row in the panel — the server declares the manifest now
- Pipeline failures discarded by a silent `.catch`
- Missing security headers, and the container running as root
- Eight duplicated lint suppressions, and the rule that forced them
- Catalog timestamps that showed the server's timezone as if it were the reader's
- A rivers cap the form did not enforce but the route did
- The river tag duplicated across two files
- Four wrong claims in `CLAUDE.md`, one of which sent styling work at the wrong `--color-primary`
- Small drift in `db.ts`, the files route, `tsconfig.json`, and `catalog.ts`
- Reverse geocoding blocking the POST for up to 5s — it runs in the pipeline now, overlapping the shop phase
- A Render build command with no `npx prisma generate`, which could only succeed while the build cache held a `generated/` from an earlier deploy

Removed rather than fixed, once Docker stopped being the deploy path: the broken
`docker build`, and `output: "standalone"` — which existed only to shrink an image
that no longer gets built.
