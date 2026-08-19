import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/server/db";

/* The run endpoint is unauthenticated and every run now costs the operator
   real money — 5 SerpAPI searches plus an OpenAI call plus a headless browser
   crawling up to 100 third-party sites. Without a limit, one curl loop drains
   a month of search quota in seconds. */

const num = (name: string, fallback: number) => {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : fallback;
};

export interface Limits {
  perClientHour: number;
  perClientDay: number;
  globalDay: number;
  globalMonth: number;
}

export const limits = (): Limits => ({
  perClientHour: num("RATE_LIMIT_CLIENT_HOUR", 3),
  perClientDay: num("RATE_LIMIT_CLIENT_DAY", 10),
  globalDay: num("RATE_LIMIT_GLOBAL_DAY", 40),
  // Sized against a monthly search-API quota: 200 runs x 5 searches = 1,000.
  globalMonth: num("RATE_LIMIT_GLOBAL_MONTH", 200),
});

const DAY_MS = 86_400_000;

/** The longest window clientHash is ever counted against. Past it the hash identifies
    a visitor without serving the limit that justified storing it, so db_cleanup nulls it. */
export const CLIENT_HASH_TTL_MS = DAY_MS;

export interface Counts {
  clientHour: number;
  clientDay: number;
  globalDay: number;
  globalMonth: number;
}

export interface Decision {
  allowed: boolean;
  reason?: string;
  retryAfterSeconds?: number;
}

/** Pure: given counts already used, decide whether one more run is allowed.
    Client limits are checked first so a busy user gets a specific message
    rather than being told the whole service is full. */
export function decide(counts: Counts, l: Limits = limits()): Decision {
  if (counts.clientHour >= l.perClientHour) {
    return { allowed: false, reason: `Rate limit: ${l.perClientHour} runs per hour. Try again shortly.`, retryAfterSeconds: 3600 };
  }
  if (counts.clientDay >= l.perClientDay) {
    return { allowed: false, reason: `Rate limit: ${l.perClientDay} runs per day. Try again tomorrow.`, retryAfterSeconds: 86400 };
  }
  if (counts.globalDay >= l.globalDay) {
    return { allowed: false, reason: "Flybox has hit its daily capacity. Try again tomorrow.", retryAfterSeconds: 86400 };
  }
  if (counts.globalMonth >= l.globalMonth) {
    return { allowed: false, reason: "Flybox has hit its monthly capacity. Try again next month.", retryAfterSeconds: 86400 };
  }
  return { allowed: true };
}

/* A per-process salt when none is configured. The point of hashing is that the
   stored value is not an identifier; an unsalted SHA-256 of an IPv4 address is
   trivially reversible by brute force, so a missing salt must not silently
   degrade to that. The cost is that limits reset on redeploy. */
const salt =
  process.env.RATE_LIMIT_SALT ||
  (() => {
    if (process.env.NODE_ENV === "production") {
      console.warn("[rateLimit] RATE_LIMIT_SALT is unset; using a per-process salt, so client limits reset on every restart.");
    }
    return randomBytes(32).toString("hex");
  })();

/** Salted hash of the caller's IP. Returns null when no address can be
    determined, which callers treat as "global limits only". */
export function clientHashFrom(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || headers.get("x-real-ip")?.trim() || null;
  if (!ip) return null;
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

export async function checkRateLimit(headers: Headers): Promise<Decision & { clientHash: string | null }> {
  const clientHash = clientHashFrom(headers);
  const now = Date.now();
  const hourAgo = new Date(now - 3_600_000);
  const dayAgo = new Date(now - DAY_MS);
  const monthAgo = new Date(now - 30 * DAY_MS);

  const [clientHour, clientDay, globalDay, globalMonth] = await Promise.all([
    clientHash ? prisma.job.count({ where: { clientHash, createdAt: { gte: hourAgo } } }) : Promise.resolve(0),
    clientHash ? prisma.job.count({ where: { clientHash, createdAt: { gte: dayAgo } } }) : Promise.resolve(0),
    prisma.job.count({ where: { createdAt: { gte: dayAgo } } }),
    prisma.job.count({ where: { createdAt: { gte: monthAgo } } }),
  ]);

  return { ...decide({ clientHour, clientDay, globalDay, globalMonth }), clientHash };
}
