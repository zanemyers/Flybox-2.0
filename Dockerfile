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

# ── Stage 4: Runtime (Playwright image has Chromium + all system deps) ─────────
FROM mcr.microsoft.com/playwright:v1.59.1-noble AS runner
WORKDIR /app
ENV NODE_ENV=production \
    RUN_HEADLESS=true

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/generated ./generated
COPY --from=builder /app/public ./public
COPY package.json ./

EXPOSE 3000
CMD ["node_modules/.bin/next", "start"]
