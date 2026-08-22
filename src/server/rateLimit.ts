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

/* A proxy appends the address it received the request from, so the RIGHTMOST entries were written by infrastructure and
   anything further left may have been typed by the caller. Reading the leftmost — the usual "client IP" convention — let
   anyone rotate X-Forwarded-For for a fresh identity per request, which retired the per-client caps entirely. Count in
   from the right instead, by however many proxies sit in front of the app. */
const TRUSTED_PROXIES = num("RATE_LIMIT_TRUSTED_PROXIES", 1);

let warnedShortChain = false;
let warnedInternalAddress = false;

/** Loopback, RFC1918, link-local, carrier NAT, IPv6 loopback and unique-local. A public app never has one of these as a
    caller, so selecting one means the entry belongs to infrastructure and the trusted count is too low. */
export function isInternalAddress(ip: string): boolean {
  // [::1]:8080 keeps the port outside the brackets, so take what is inside them rather than trimming the ends.
  const bracketed = /^\[([^\]]+)\]/.exec(ip);
  const value = (bracketed ? bracketed[1] : ip).split("%")[0];
  if (value === "::1" || /^f[cd]/i.test(value)) return true;
  const [a, b] = value.split(".").map(Number);
  if (!Number.isInteger(a) || !Number.isInteger(b)) return false;
  if (a === 127 || a === 10) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  return a === 100 && b >= 64 && b <= 127;
}

/** The caller's address as vouched for by the proxy in front of us, or null when nothing vouched for one. */
export function clientIpFrom(headers: Headers, trustedProxies: number = TRUSTED_PROXIES): string | null {
  const trusted = Math.max(1, Math.floor(trustedProxies));
  const chain = (headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  // Nothing forwarded this, so there is no proxy whose word to take. x-real-ip is a guess, and only better than nothing.
  if (chain.length === 0) return headers.get("x-real-ip")?.trim() || null;

  /* Fewer hops than configured means the count is too high for this deployment, which is the one setting that reopens
     the hole above. Fall back to the rightmost — the single entry a proxy definitely wrote — and say so once. */
  if (chain.length < trusted) {
    if (!warnedShortChain) {
      warnedShortChain = true;
      console.warn(
        `[rateLimit] RATE_LIMIT_TRUSTED_PROXIES is ${trusted} but x-forwarded-for arrived with ${chain.length}; using the last entry. Set it to the number of proxies actually in front of the app.`,
      );
    }
    return chain[chain.length - 1];
  }

  const selected = chain[chain.length - trusted];

  /* The opposite misconfiguration to the one above, and the quiet one: a count set too low picks a proxy's own address,
     which is the same for everybody, so every caller shares a single limit and legitimate traffic starts getting 429s. */
  if (selected && isInternalAddress(selected) && !warnedInternalAddress) {
    warnedInternalAddress = true;
    console.warn(
      `[rateLimit] x-forwarded-for resolved to ${selected}, an internal address, so RATE_LIMIT_TRUSTED_PROXIES is probably below the ${chain.length} hops in front of the app. Every caller is sharing one limit until it matches.`,
    );
  }

  return selected;
}

/** Salted hash of the caller's IP. Returns null when no address can be
    determined, which callers treat as "global limits only". */
export function clientHashFrom(headers: Headers): string | null {
  const ip = clientIpFrom(headers);
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
