// Every range that must stay unreachable, pinned rather than trusted to the table reading right.

import { beforeEach, describe, expect, it, vi } from "vitest";

const resolve4 = vi.hoisted(() => vi.fn());
const resolve6 = vi.hoisted(() => vi.fn());
vi.mock("node:dns/promises", () => ({
  Resolver: class {
    resolve4 = resolve4;
    resolve6 = resolve6;
  },
}));

const { checkUrl, expandV6, isBlockedAddress } = await import("@/server/net");

// ── isBlockedAddress ───────────────────────────────────────────────────────────

describe("isBlockedAddress", () => {
  it("blocks loopback", () => {
    expect(isBlockedAddress("127.0.0.1")).toBe(true);
    expect(isBlockedAddress("127.255.255.254")).toBe(true);
    expect(isBlockedAddress("::1")).toBe(true);
  });

  it("blocks the cloud metadata address", () => {
    expect(isBlockedAddress("169.254.169.254")).toBe(true);
  });

  it("blocks every RFC1918 range, including the edges of 172.16/12", () => {
    expect(isBlockedAddress("10.0.0.1")).toBe(true);
    expect(isBlockedAddress("192.168.1.1")).toBe(true);
    expect(isBlockedAddress("172.16.0.0")).toBe(true);
    expect(isBlockedAddress("172.31.255.255")).toBe(true);
  });

  it("does not overreach past 172.16/12 into public space", () => {
    expect(isBlockedAddress("172.15.255.255")).toBe(false);
    expect(isBlockedAddress("172.32.0.0")).toBe(false);
  });

  it("blocks carrier NAT, benchmarking, multicast and reserved space", () => {
    expect(isBlockedAddress("100.64.0.1")).toBe(true);
    expect(isBlockedAddress("198.18.0.1")).toBe(true);
    expect(isBlockedAddress("224.0.0.1")).toBe(true);
    expect(isBlockedAddress("255.255.255.255")).toBe(true);
    expect(isBlockedAddress("0.0.0.0")).toBe(true);
  });

  it("allows ordinary public addresses", () => {
    expect(isBlockedAddress("8.8.8.8")).toBe(false);
    expect(isBlockedAddress("104.18.32.7")).toBe(false);
    expect(isBlockedAddress("2606:4700::1111")).toBe(false);
  });

  it("blocks IPv6 unique-local, link-local and multicast", () => {
    expect(isBlockedAddress("fc00::1")).toBe(true);
    expect(isBlockedAddress("fd12:3456::1")).toBe(true);
    expect(isBlockedAddress("fe80::1")).toBe(true);
    expect(isBlockedAddress("ff02::1")).toBe(true);
  });

  // These carry the v4 address in their tail, so the v4 rules must decide them, not the v6 table.
  it("sees through IPv4-mapped IPv6", () => {
    expect(isBlockedAddress("::ffff:127.0.0.1")).toBe(true);
    expect(isBlockedAddress("::ffff:169.254.169.254")).toBe(true);
    expect(isBlockedAddress("::ffff:8.8.8.8")).toBe(false);
  });

  it("sees through NAT64", () => {
    expect(isBlockedAddress("64:ff9b::127.0.0.1")).toBe(true);
    expect(isBlockedAddress("64:ff9b::8.8.8.8")).toBe(false);
  });

  it("tolerates brackets and a zone id", () => {
    expect(isBlockedAddress("[::1]")).toBe(true);
    expect(isBlockedAddress("fe80::1%eth0")).toBe(true);
  });

  it("blocks anything that is not an address at all", () => {
    expect(isBlockedAddress("")).toBe(true);
    expect(isBlockedAddress("example.com")).toBe(true);
    expect(isBlockedAddress("1.2.3")).toBe(true);
    expect(isBlockedAddress("1.2.3.256")).toBe(true);
  });
});

// ── expandV6 ───────────────────────────────────────────────────────────────────

describe("expandV6", () => {
  it("expands an elided run to eight groups", () => {
    expect(expandV6("::1")).toEqual([0, 0, 0, 0, 0, 0, 0, 1]);
    expect(expandV6("fe80::1")).toEqual([0xfe80, 0, 0, 0, 0, 0, 0, 1]);
  });

  it("keeps a fully written address as-is", () => {
    expect(expandV6("2001:0db8:0000:0000:0000:0000:0000:0001")).toEqual([0x2001, 0xdb8, 0, 0, 0, 0, 0, 1]);
  });

  it("folds a trailing dotted quad into two groups", () => {
    expect(expandV6("::ffff:1.2.3.4")).toEqual([0, 0, 0, 0, 0, 0xffff, 0x0102, 0x0304]);
  });

  it("rejects malformed input rather than guessing", () => {
    expect(expandV6("1::2::3")).toBeNull();
    expect(expandV6("2001:db8")).toBeNull();
    expect(expandV6("gggg::1")).toBeNull();
  });
});

// ── checkUrl ───────────────────────────────────────────────────────────────────

describe("checkUrl", () => {
  beforeEach(() => {
    resolve4.mockReset().mockImplementation(async () => []);
    resolve6.mockReset().mockImplementation(async () => []);
  });

  const noLookup = () => {
    expect(resolve4).not.toHaveBeenCalled();
    expect(resolve6).not.toHaveBeenCalled();
  };

  it("refuses a scheme that is not http(s), without a lookup", async () => {
    for (const url of ["file:///etc/passwd", "gopher://host/", "ftp://host/x"]) {
      expect((await checkUrl(url)).ok).toBe(false);
    }
    noLookup();
  });

  it("refuses something that is not a URL", async () => {
    expect((await checkUrl("not a url")).ok).toBe(false);
  });

  it("refuses local names without a lookup, so a resolver cannot vouch for them", async () => {
    for (const host of ["localhost", "foo.localhost", "printer.local", "db.internal", "x.home.arpa"]) {
      expect((await checkUrl(`http://${host}/`)).ok).toBe(false);
    }
    noLookup();
  });

  it("judges a literal address directly, with no lookup", async () => {
    expect((await checkUrl("http://169.254.169.254/latest/meta-data/")).ok).toBe(false);
    expect((await checkUrl("http://[::1]:5432/")).ok).toBe(false);
    expect((await checkUrl("http://8.8.8.8/")).ok).toBe(true);
    noLookup();
  });

  it("allows a host that resolves to public space", async () => {
    resolve4.mockImplementation(async () => ["104.18.32.7"]);
    expect((await checkUrl("https://shop.example.com/reports")).ok).toBe(true);
  });

  it("allows an IPv6-only host", async () => {
    resolve6.mockImplementation(async () => ["2606:4700::1111"]);
    expect((await checkUrl("https://v6.example.com/")).ok).toBe(true);
  });

  it("refuses a host that resolves into a blocked range", async () => {
    resolve4.mockImplementation(async () => ["127.0.0.1"]);
    const verdict = await checkUrl("https://evil.example.com/");
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toContain("127.0.0.1");
  });

  // Taking the public answer as permission would defeat the guard entirely.
  it("refuses when only one of several answers is blocked", async () => {
    resolve4.mockImplementation(async () => ["104.18.32.7", "10.0.0.5"]);
    expect((await checkUrl("https://split.example.com/")).ok).toBe(false);
  });

  it("refuses when the blocked answer is in the other family", async () => {
    resolve4.mockImplementation(async () => ["104.18.32.7"]);
    resolve6.mockImplementation(async () => ["::1"]);
    expect((await checkUrl("https://split6.example.com/")).ok).toBe(false);
  });

  it("refuses a host that does not resolve, rather than letting it through", async () => {
    // Thrown from the implementation rather than mockRejectedValue, which builds its rejected
    // promise at setup time and gets reported as unhandled before the call consumes it.
    const fail = async () => {
      throw new Error("ENOTFOUND");
    };
    resolve4.mockImplementation(fail);
    resolve6.mockImplementation(fail);
    expect((await checkUrl("https://nothing.example.com/")).ok).toBe(false);
  });

  it("refuses a host that answers with no records at all", async () => {
    expect((await checkUrl("https://empty.example.com/")).ok).toBe(false);
  });

  it("ignores a trailing dot on the hostname", async () => {
    resolve4.mockImplementation(async () => ["104.18.32.7"]);
    expect((await checkUrl("https://shop.example.com./")).ok).toBe(true);
    expect(resolve4).toHaveBeenCalledWith("shop.example.com");
  });

  it("does not let a port or userinfo change which host is judged", async () => {
    expect((await checkUrl("http://user:pass@127.0.0.1:8080/")).ok).toBe(false);
    noLookup();
  });
});
