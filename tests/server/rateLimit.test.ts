/* The run endpoint is unauthenticated and every run spends the operator's money,
   so these pin the order and the boundaries of the limit checks. */
import { describe, expect, it } from "vitest";
import { type Counts, clientHashFrom, clientIpFrom, decide, isInternalAddress, type Limits } from "@/server/rateLimit";

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

  it("never honours a count below one, which would read the caller's own entry", () => {
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
  it("recognises the ranges a proxy hop appears on", () => {
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
