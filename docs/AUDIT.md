# Production Readiness Audit

**Snapshot:** 2026-08-21, against `882e61f` on `redesign/tailwater`.
**Scope:** all of `src/`, `scripts/`, `db/`, plus `Dockerfile`, `next.config.ts`, `biome.json`, `tsconfig.json` — about 5,200 lines.

This is a working list, not reference documentation. It goes stale as items are
fixed; check the commit above before trusting any line of it. When an item is
done, delete it rather than marking it done — the changelog is where finished
work belongs.

State of the tree at the time of the audit: `npm run check` green (Biome clean,
`tsc` clean, 150 server tests passing), no `any`, no non-null assertions,
`strict` on, no meaningful dead exports.

---

## Production risks

### 1. The per-client rate limit is bypassable

`src/server/rateLimit.ts:83`

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
`Strict-Transport-Security`, `poweredByHeader: false`, and the container no
longer runs as root.

**One unverified assumption in that last part:** the `Dockerfile` takes it on
trust that `pwuser` exists in `mcr.microsoft.com/playwright:v1.62.0-noble`. It
could not be checked from the dev sandbox — MCR's blob CDN host does not resolve
there, so the image cannot be pulled. A single `docker build .` settles it: a
missing user fails the `COPY --chown`, and failing that, `USER` fails at
container start. Both are loud and happen before any traffic is served.

Related, and also resting on that user: the documented pre-deploy command is
`npx prisma migrate deploy`, which now runs as `pwuser`. `npx` wants a writable
`HOME`. `/home/pwuser` exists and is owned by that user in Microsoft's images, so
this should be fine, but `node_modules/.bin/prisma migrate deploy` would sidestep
`npx`'s cache directory entirely. Changing it means editing the Render dashboard,
so it is a decision, not a cleanup.

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

### 3. `/runs` timestamps render in the server's timezone

`src/app/runs/page.tsx:13`

`fmtDate` calls `toLocaleString("en-US", …)` inside a server component, so on
Render every run is stamped in UTC with nothing indicating it. A user in Denver
reads a time six hours off.

**Fix:** format client-side, or state the zone explicitly.

### 4. Client and server disagree about rivers

`src/app/api/flybox/route.ts:21,28` vs `src/client/components/inputs/tagInput.tsx`

The route caps rivers at 25 entries and silently truncates each to 60 characters.
`TagInput` enforces neither, so a user who adds 30 tags finds out by having the
run rejected after they press Run.

**Fix:** cap in `TagInput` too, from a shared constant so they cannot drift.

### 5. Reverse geocoding blocks the POST

`src/app/api/flybox/route.ts:65`

`reverseGeocode` is awaited — up to its 5s timeout — before the job is created,
for a purely cosmetic catalog label. That latency lands directly on the user
pressing Run.

**Fix:** create the job first, fill `locationName` afterward.

---

## Cleanliness

### 6. CLAUDE.md has drifted, and one line is actively misleading

`CLAUDE.md:72,76,92,102`

This is the file that steers every future change, and the `docs/` refresh in
`882e61f` did not touch it.

- **`:102` is wrong in a way that misdirects work.** It says "**Navy** (hue 255)
  is the chassis. **Olive** (hue 112) is the single brand accent,
  `--color-primary`." The palette was rebuilt blue-led in `69f8975`: the base is
  hue 222–225, `--color-primary` is `#0d667a` teal-blue (hue 218.3), and olive is
  `--color-accent`. Anyone following this line styles with the wrong token.
- `:76` still says the report phase "feeds text to Gemini for summarization."
- `:72` says "Five files, each with a single responsibility" for a `src/server/`
  that now has nine.
- `:92` lists the `Job` schema without `rawFile`, `clientHash`, or the six
  catalog columns.

### 7. Eight copies of the same `biome-ignore` comment

`src/app/page.tsx`, `about/page.tsx`, `how-it-works/page.tsx`, `runs/page.tsx` (×3),
`header.tsx`, `statusPanel.tsx`

Every list in this app is `list-none`, which means `noRedundantRoles` is wrong
here every single time it fires. Eight copies of the same 130-character
suppression is the rule telling us it does not apply to this codebase.

**Fix:** turn `noRedundantRoles` off once in `biome.json` with one comment
explaining why, and delete all eight.

### 8. The river tag is duplicated

`src/app/runs/page.tsx:101`, `src/client/components/inputs/tagInput.tsx:73`

Same six utilities in both places, and both still on `rounded-[2px]` rather than
the `rounded-xs` the rest of the app moved to.

**Fix:** a `.tag` primitive in `globals.css`, next to `.chip`.

### 9. Smaller items

- `src/server/db.ts:7` re-exports `Job` and `JobMessage` types that nothing
  imports.
- `src/server/handler.ts:158` and `:172` each re-encode the `OUTPUT_FILES`
  mapping by hand instead of iterating it — three places now know the file list.
- `src/app/api/flybox/[id]/files/[name]/route.ts:3` says "two fixed outputs."
- `tsconfig.json` targets ES2017 on a Node 22 / Next 16 app.

### 10. `output: "standalone"` would shrink the image

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
- **No unhandled rejection from the fire-and-forget pipeline.** The `.catch` at
  `route.ts:67` is present; the problem is only that it is silent (see item 3).

---

## Suggested order

1. Item **1** — exploitable, and the last of the original high-severity three.
2. Items **6, 7** — near-free, and the first actively misdirects future work.
3. Items **3, 4, 5** — small correctness and latency fixes.
4. Items **2, 8, 9, 10** — hardening and cleanup. The CSP is the largest thing left.

Fixed on 2026-08-21, from the original list: abandoned `IN_PROGRESS` runs living
forever, the third file auto-downloading with no row in the panel, swallowed
pipeline failures, the missing security headers, and the container running as
root. See the changelog.
