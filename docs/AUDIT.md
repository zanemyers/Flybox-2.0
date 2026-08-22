# Production Readiness Audit

**Snapshot:** 2026-08-21, last revised against `fc7a852` on `redesign/tailwater`.
**Scope:** all of `src/`, `scripts/`, `db/`, plus `Dockerfile`, `next.config.ts`, `biome.json`, `tsconfig.json` — about 5,200 lines.

This is a working list, not reference documentation. It goes stale as items are
fixed; check the commit above before trusting any line of it. When an item is
done, delete it rather than marking it done — the changelog is where finished
work belongs.

State of the tree: `npm run check` green (Biome clean, `tsc` clean, 169 server
tests passing), no `any`, no non-null assertions, `strict` on, no dead exports.
Note that green here says nothing about the Docker build — see item 2.

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

### 2. The Docker build cannot currently succeed

`package-lock.json`, `prisma.config.ts` / `Dockerfile`

Two independent failures, both found by running `docker build .` on 2026-08-21.
Both predate the work of that day and neither is caused by it. The image that is
deployed today most likely predates the current lockfile.

**`npm ci` fails in the `deps` stage.**

```
Missing: @emnapi/runtime@1.11.3 from lock file
Missing: @emnapi/core@1.11.3 from lock file
```

`@emnapi/*` are transitive dependencies of the Linux `@img/sharp-*` binaries that
Next's image optimizer pulls in. The lockfile was generated on macOS, where those
variants never resolve, so it has no entry for them: `npm ci --dry-run` reports
"up to date" locally and the same command fails on Linux. This will bite on
Render too, which builds on Linux. The fix is a lockfile regeneration that
resolves the full cross-platform optional tree — worth diffing carefully, since
it can move transitive versions across the whole graph.

**`npx prisma generate` fails in the `builder` stage.**

```
PrismaConfigEnvError: Cannot resolve environment variable: DIRECT_URL.
```

`prisma.config.ts` calls `env("DIRECT_URL")`, which throws when unset, and
`.dockerignore` excludes `.env*`. `generate` is offline and needs no real
database, only a config that loads — so either an `ARG`/`ENV` placeholder in the
builder stage, or making the datasource url lazy so `generate` does not demand it.

Both were worked around with a throwaway Dockerfile to verify the non-root
change; see the changelog entry for that commit for what the workaround was.

### 3. No Content-Security-Policy

`next.config.ts`

Everything else on this front is done — `X-Content-Type-Options`,
`Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy`,
`Strict-Transport-Security`, `poweredByHeader: false`, and the container no
longer runs as root.

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

### 4. Reverse geocoding blocks the POST

`src/app/api/flybox/route.ts:69`

`reverseGeocode` is awaited — up to its 5s timeout — before the job is created,
for a purely cosmetic catalog label. That latency lands directly on the user
pressing Run.

**Fix:** create the job first, fill `locationName` afterward.

---

## Cleanliness

### 5. `OUTPUT_FILES` is re-encoded by hand

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

### 6. `output: "standalone"` would shrink the image

`next.config.ts`

The runner copies the full production `node_modules`. Standalone output prunes it
to what the build actually reaches — a much smaller change than the planned
Docker → native-Node switch, and it does not foreclose that switch.

---

## Checked and ruled out

- **Playwright browsers are not downloaded twice during the Docker build.**
  Neither `playwright` nor `playwright-core` has a postinstall hook in the
  current lockfile.
- **`/runs` is not statically cached.** `export const dynamic = "force-dynamic"`
  is present (`runs/page.tsx:11`).
- **The browser-direct OpenStreetMap call is disclosed.** The privacy policy
  covers both the server-side lookup and the map search box running from the
  user's browser, including the IP exposure. The residual concern is only
  operational: that call sends no identifying `User-Agent`, unlike
  `geocode.ts`, so it is the path most likely to get rate-limited by Nominatim.
- **No unhandled rejection from the fire-and-forget pipeline**, and it is no
  longer silent — the `.catch` in `route.ts` logs with the job id.
- **`pwuser` exists in the Playwright base image.** Settled by the `docker build`
  run on 2026-08-21, which also turned up that `node_modules` needs the same
  `--chown` as `.next`, because `prisma migrate deploy` writes to
  `node_modules/@prisma/engines`. One residual unknown, not worth chasing until
  a deploy is attempted: the pre-deploy command is `npx prisma migrate deploy`,
  and `npx` wants a writable `HOME`. `node_modules/.bin/prisma migrate deploy`
  would sidestep its cache directory, but changing it means editing the Render
  dashboard.

---

## Suggested order

1. Items **1, 2** — one is exploitable, the other blocks deploying anything at all.
2. Item **4** — a small latency fix.
3. Items **3, 5, 6** — hardening and cleanup. The CSP is the largest thing left.

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
