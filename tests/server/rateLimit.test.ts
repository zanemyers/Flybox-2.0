/* The run endpoint is unauthenticated and every run spends the operator's money,
   so these pin the order and the boundaries of the limit checks. */
import { beforeEach, describe, expect, it } from "vitest";
import { allowDownload, type Counts, clientHashFrom, clientIpFrom, decide, isInternalAddress, type Limits, resetDownloadCounts } from "@/server/rateLimit";
import { CLIENT_HASH_TTL_MS, ledgerCutoff, RATE_LIMIT_WINDOW_MS } from "@/server/retention";

const L: Limits = { perClientHour: 3, perClientDay: 10, globalDay: 40, globalMonth: 200 };
const counts = (c: Partial<Counts> = {}): Counts => ({ clientHour: 0, clientDay: 0, globalDay: 0, globalMonth: 0, ...c });

describe("decide", () => {
  it("allows a first run", () => {
    expect(decide(counts(), L).allowed).toBe(true);
  });

  it("allows right up to each limit, and blocks at it", () => {
    expect(decide(counts({ clientHour: 2 }), L).allowed).toBe(true);
    expect(decide(counts({ clientHour: 3 }), L).allowed).toBe(false);
    expect(decide(counts({ clientDay: 9 }), L).allowed).toBe(true);
    expect(decide(counts({ clientDay: 10 }), L).allowed).toBe(false);
    expect(decide(counts({ globalDay: 39 }), L).allowed).toBe(true);
    expect(decide(counts({ globalDay: 40 }), L).allowed).toBe(false);
    expect(decide(counts({ globalMonth: 199 }), L).allowed).toBe(true);
    expect(decide(counts({ globalMonth: 200 }), L).allowed).toBe(false);
  });

  it("blames the client before blaming the service", () => {
    // Both are exhausted; the user should be told it is their own limit.
    const d = decide(counts({ clientHour: 3, globalDay: 40 }), L);
    expect(d.allowed).toBe(false);
    expect(d.reason).toMatch(/per hour/i);
  });

  it("gives a Retry-After hint scaled to the window that tripped", () => {
    expect(decide(counts({ clientHour: 3 }), L).retryAfterSeconds).toBe(3600);
    expect(decide(counts({ clientDay: 10 }), L).retryAfterSeconds).toBe(86400);
  });

  it("distinguishes a global stop from a personal one", () => {
    expect(decide(counts({ globalDay: 40 }), L).reason).toMatch(/capacity/i);
    expect(decide(counts({ globalMonth: 200 }), L).reason).toMatch(/monthly capacity/i);
  });
});

describe("clientHashFrom", () => {
  const h = (init: Record<string, string>) => clientHashFrom(new Headers(init));

  it("does not return the raw address", () => {
    const hash = h({ "x-forwarded-for": "203.0.113.7" });
    expect(hash).not.toBeNull();
    expect(hash).not.toContain("203.0.113.7");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("is stable for the same address and different for another", () => {
    expect(h({ "x-forwarded-for": "203.0.113.7" })).toBe(h({ "x-forwarded-for": "203.0.113.7" }));
    expect(h({ "x-forwarded-for": "203.0.113.7" })).not.toBe(h({ "x-forwarded-for": "203.0.113.8" }));
  });

  it("falls back to x-real-ip, and returns null when there is no address", () => {
    expect(h({ "x-real-ip": "203.0.113.9" })).toMatch(/^[a-f0-9]{64}$/);
    expect(h({})).toBeNull();
  });

  /* The whole point of the change: whatever a caller puts in front of the entry the proxy
     appended must not change who we think they are. Reading the leftmost value made
     rotating this header a free identity, which meant no per-client limit at all. */
  it("gives the same identity however the caller pads the header", () => {
    const real = h({ "x-forwarded-for": "203.0.113.7" });
    expect(h({ "x-forwarded-for": "9.9.9.9, 203.0.113.7" })).toBe(real);
    expect(h({ "x-forwarded-for": "8.8.8.8, 203.0.113.7" })).toBe(real);
    expect(h({ "x-forwarded-for": "1.1.1.1, 2.2.2.2, 3.3.3.3, 203.0.113.7" })).toBe(real);
  });

  it("still separates two genuinely different callers", () => {
    expect(h({ "x-forwarded-for": "9.9.9.9, 203.0.113.7" })).not.toBe(h({ "x-forwarded-for": "9.9.9.9, 203.0.113.8" }));
  });
});

describe("clientIpFrom", () => {
  const ip = (xff: string, trusted?: number) => clientIpFrom(new Headers({ "x-forwarded-for": xff }), trusted);

  it("takes the last entry behind a single proxy", () => {
    expect(ip("203.0.113.7")).toBe("203.0.113.7");
    expect(ip("9.9.9.9, 203.0.113.7")).toBe("203.0.113.7");
  });

  it("counts in from the right by the number of proxies in front", () => {
    // Caller forged 9.9.9.9; the first LB appended the real address, the second appended the first LB's.
    expect(ip("9.9.9.9, 203.0.113.7, 10.0.0.1", 2)).toBe("203.0.113.7");
    expect(ip("9.9.9.9, 203.0.113.7, 10.0.0.1, 10.0.0.2", 3)).toBe("203.0.113.7");
  });

  it("falls back to the rightmost when the chain is shorter than configured", () => {
    // A count set too high would otherwise index past the left end and land on whatever the caller sent.
    expect(ip("203.0.113.7", 3)).toBe("203.0.113.7");
    expect(ip("9.9.9.9, 203.0.113.7", 5)).toBe("203.0.113.7");
  });

  it("never honors a count below one, which would read the caller's own entry", () => {
    expect(ip("9.9.9.9, 203.0.113.7", 0)).toBe("203.0.113.7");
    expect(ip("9.9.9.9, 203.0.113.7", -4)).toBe("203.0.113.7");
  });

  it("tolerates the whitespace and empty entries real chains carry", () => {
    expect(ip("  9.9.9.9 ,   203.0.113.7  ")).toBe("203.0.113.7");
    expect(ip("9.9.9.9, , 203.0.113.7,")).toBe("203.0.113.7");
    expect(clientIpFrom(new Headers({ "x-forwarded-for": " , ", "x-real-ip": "203.0.113.9" }))).toBe("203.0.113.9");
  });
});

/* Not a security boundary — the trusted-proxy count is. This only decides whether a
   misconfigured count gets noticed, so the ranges platforms actually route through
   matter more than exhaustiveness. */
describe("isInternalAddress", () => {
  it("recognizes the ranges a proxy hop appears on", () => {
    for (const ip of [
      "127.0.0.1",
      "10.0.0.1",
      "192.168.1.1",
      "169.254.10.1",
      "172.16.0.1",
      "172.31.255.1",
      "100.64.0.1",
      "100.127.0.1",
      "::1",
      "fd00::1",
      "fc00::1",
    ]) {
      expect(isInternalAddress(ip), ip).toBe(true);
    }
  });

  it("leaves real caller addresses alone", () => {
    for (const ip of ["203.0.113.7", "8.8.8.8", "172.15.0.1", "172.32.0.1", "100.63.0.1", "100.128.0.1", "192.167.1.1", "2001:db8::1"]) {
      expect(isInternalAddress(ip), ip).toBe(false);
    }
  });

  it("copes with a port or a zone attached", () => {
    expect(isInternalAddress("10.0.0.1:8080")).toBe(true);
    expect(isInternalAddress("[::1]:8080")).toBe(true);
    expect(isInternalAddress("203.0.113.7:443")).toBe(false);
  });
});

// ── Retention vs the windows it has to outlive ────────────────────────────────

/* The defect these pin: the caps used to count Job rows, which retention deletes on the catalog's
   schedule, so every window silently shortened to "whatever survived the last prune". Evidence has
   to outlive the claim made from it. */
describe("rate-limit evidence outlives the windows that count it", () => {
  const HOUR_MS = 3_600_000;
  const DAY_MS = 86_400_000;

  it("keeps ledger rows at least as long as the longest window any cap counts over", () => {
    // The monthly cap counts over exactly this window, so the two must be the same number.
    expect(RATE_LIMIT_WINDOW_MS).toBeGreaterThanOrEqual(30 * DAY_MS);
  });

  it("outlives every shorter window too, so no cap can quietly count past its evidence", () => {
    for (const window of [HOUR_MS, DAY_MS, 30 * DAY_MS]) {
      expect(RATE_LIMIT_WINDOW_MS).toBeGreaterThanOrEqual(window);
    }
  });

  it("keeps the client hash no longer than the longest per-client window needs it", () => {
    // Per-client caps are hourly and daily, so a day is the most the hash can justify.
    expect(CLIENT_HASH_TTL_MS).toBeGreaterThanOrEqual(DAY_MS);
    expect(CLIENT_HASH_TTL_MS).toBeLessThan(RATE_LIMIT_WINDOW_MS);
  });

  it("does not tie the ledger to the catalog, which is what broke the caps", () => {
    // A count, not a coupling: CATALOG_LIMIT is a number of runs and cannot bound a time window.
    expect(ledgerCutoff().getTime()).toBeLessThanOrEqual(Date.now() - 30 * DAY_MS);
  });
});

// ── allowDownload ──────────────────────────────────────────────────────────────

// In memory and much looser than the run caps, but it still has to bound something.
describe("allowDownload", () => {
  const from = (ip: string) => new Headers({ "x-forwarded-for": ip });
  const T0 = 1_000_000;

  beforeEach(() => resetDownloadCounts());

  it("allows a normal burst of clicks", () => {
    for (let i = 0; i < 60; i++) {
      expect(allowDownload(from("203.0.113.9"), T0 + i).allowed).toBe(true);
    }
  });

  it("refuses past the per-minute cap", () => {
    for (let i = 0; i < 60; i++) allowDownload(from("203.0.113.9"), T0 + i);
    const verdict = allowDownload(from("203.0.113.9"), T0 + 60);
    expect(verdict.allowed).toBe(false);
    expect(verdict.reason).toMatch(/too many downloads/i);
  });

  it("tells the caller how long to wait, and never zero", () => {
    for (let i = 0; i < 60; i++) allowDownload(from("203.0.113.9"), T0 + i);
    const verdict = allowDownload(from("203.0.113.9"), T0 + 60);
    expect(verdict.retryAfterSeconds).toBeGreaterThanOrEqual(1);
    expect(verdict.retryAfterSeconds).toBeLessThanOrEqual(60);
  });

  it("counts each caller separately", () => {
    for (let i = 0; i < 60; i++) allowDownload(from("203.0.113.9"), T0 + i);
    expect(allowDownload(from("203.0.113.9"), T0 + 60).allowed).toBe(false);
    // A different address starts with a clean window.
    expect(allowDownload(from("198.51.100.4"), T0 + 60).allowed).toBe(true);
  });

  it("forgets hits once they leave the window", () => {
    for (let i = 0; i < 60; i++) allowDownload(from("203.0.113.9"), T0 + i);
    expect(allowDownload(from("203.0.113.9"), T0 + 60).allowed).toBe(false);
    // A minute and a bit later every one of those has aged out.
    expect(allowDownload(from("203.0.113.9"), T0 + 61_000).allowed).toBe(true);
  });

  it("shares one bucket when no address can be attributed", () => {
    const anon = new Headers();
    for (let i = 0; i < 60; i++) allowDownload(anon, T0 + i);
    expect(allowDownload(anon, T0 + 60).allowed).toBe(false);
  });
});
