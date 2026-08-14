# ── Stage 1: All deps (needed for build tools like prisma, tsc, tailwind) ─────
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# ── Stage 2: Production-only deps (no devDependencies) ────────────────────────
FROM node:22-bookworm-slim AS prod-deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# ── Stage 3: Build ─────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Generate Prisma client for linux, then build Next.js
RUN npx prisma generate && npm run build

# ── Stage 4: Runtime ───────────────────────────────────────────────────────────
# This tag MUST track the `playwright` version in package-lock.json: the image
# ships the Chromium build that exactly that release expects, and a mismatch
# fails at launch with "Executable doesn't exist at /ms-playwright/chromium-*".
FROM mcr.microsoft.com/playwright:v1.62.0-noble AS runner
WORKDIR /app
ENV NODE_ENV=production \
    RUN_HEADLESS=true

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/generated ./generated
COPY --from=builder /app/public ./public
COPY package.json ./
# Required by `npx prisma migrate deploy`, which the deploy docs run as a
# pre-deploy step — without the schema and its config that command fails.
COPY db ./db
COPY prisma.config.ts ./

EXPOSE 3000
CMD ["node_modules/.bin/next", "start"]
