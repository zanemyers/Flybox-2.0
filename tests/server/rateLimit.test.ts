/* The run endpoint is unauthenticated and every run spends the operator's money,
   so these pin the order and the boundaries of the limit checks. */
import { describe, expect, it } from "vitest";
import { type Counts, clientHashFrom, decide, type Limits } from "@/server/rateLimit";

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

  it("uses only the first hop of a proxy chain", () => {
    expect(h({ "x-forwarded-for": "203.0.113.7, 70.41.3.18, 150.172.238.178" })).toBe(h({ "x-forwarded-for": "203.0.113.7" }));
  });

  it("falls back to x-real-ip, and returns null when there is no address", () => {
    expect(h({ "x-real-ip": "203.0.113.9" })).toMatch(/^[a-f0-9]{64}$/);
    expect(h({})).toBeNull();
  });
});
