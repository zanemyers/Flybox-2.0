// Guards every outbound fetch. Imports nothing from the app, so scraper.ts and browser.ts share it.

import { Resolver } from "node:dns/promises";
import { isIP, isIPv4 } from "node:net";

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

// Matched before DNS, so a resolver answering these with a public address cannot vouch for them.
const BLOCKED_SUFFIXES = ["localhost", ".localhost", ".local", ".internal", ".home.arpa"];

/** Per-attempt resolver timeout; two tries, so a slow origin costs at most twice this. */
const DNS_TIMEOUT_MS = 3_000;

// Every IANA special-purpose range, not only the private ones.
const BLOCKED_V4: [base: string, bits: number][] = [
  ["0.0.0.0", 8], // "this network"
  ["10.0.0.0", 8], // private
  ["100.64.0.0", 10], // carrier NAT
  ["127.0.0.0", 8], // loopback
  ["169.254.0.0", 16], // link-local, and cloud instance metadata
  ["172.16.0.0", 12], // private
  ["192.0.0.0", 24], // IETF protocol assignments
  ["192.0.2.0", 24], // TEST-NET-1
  ["192.168.0.0", 16], // private
  ["198.18.0.0", 15], // benchmarking
  ["198.51.100.0", 24], // TEST-NET-2
  ["203.0.113.0", 24], // TEST-NET-3
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved, includes 255.255.255.255
];

/** Dotted quad to a 32-bit number, or null when it is not one. Rejects "1.2.3.04" and "1.2.3.256". */
function v4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const part of parts) {
    if (!/^(?:0|[1-9]\d{0,2})$/.test(part)) return null;
    const value = Number(part);
    if (value > 255) return null;
    n = n * 256 + value;
  }
  return n;
}

function v4Blocked(ip: string): boolean {
  const value = v4ToInt(ip);
  if (value === null) return true; // unparseable is not something to connect to
  return BLOCKED_V4.some(([base, bits]) => {
    const baseValue = v4ToInt(base);
    if (baseValue === null) return false;
    // >>> 32 is a no-op in JS, so a /0 would match everything — none of the table uses one.
    return (value ^ baseValue) >>> (32 - bits) === 0;
  });
}

// Compared as 16-bit groups. ::ffff:0:0/96 and 64:ff9b::/96 are handled before this, by the v4 rules.
const BLOCKED_V6: [groups: number[], bits: number][] = [
  [[0, 0, 0, 0, 0, 0, 0, 0], 128], // unspecified
  [[0, 0, 0, 0, 0, 0, 0, 1], 128], // loopback
  [[0x100, 0, 0, 0], 64], // discard-only
  [[0x2001, 0xdb8], 32], // documentation
  [[0xfc00], 7], // unique-local
  [[0xfe80], 10], // link-local
  [[0xff00], 8], // multicast
];

/** Expands an IPv6 literal to its eight groups, resolving `::` and a trailing dotted quad. */
export function expandV6(ip: string): number[] | null {
  let text = ip.split("%")[0]; // strip any zone id

  // A trailing IPv4 form ("::ffff:127.0.0.1") becomes the two hex groups it stands for.
  const tail = /:(\d+\.\d+\.\d+\.\d+)$/.exec(text);
  if (tail) {
    const value = v4ToInt(tail[1]);
    if (value === null) return null;
    text = `${text.slice(0, tail.index)}:${(value >>> 16).toString(16)}:${(value & 0xffff).toString(16)}`;
  }

  const halves = text.split("::");
  if (halves.length > 2) return null;

  const parse = (part: string): number[] | null => {
    if (!part) return [];
    const groups: number[] = [];
    for (const group of part.split(":")) {
      if (!/^[0-9a-f]{1,4}$/i.test(group)) return null;
      groups.push(Number.parseInt(group, 16));
    }
    return groups;
  };

  const head = parse(halves[0]);
  const rest = halves.length === 2 ? parse(halves[1]) : [];
  if (head === null || rest === null) return null;

  if (halves.length === 1) return head.length === 8 ? head : null;

  const fill = 8 - head.length - rest.length;
  if (fill < 1) return null; // `::` must stand for at least one group
  return [...head, ...Array(fill).fill(0), ...rest];
}

/** True when the group array starts with `prefix` for `bits` bits. */
function hasPrefix(groups: number[], prefix: number[], bits: number): boolean {
  for (let i = 0; i < prefix.length; i++) {
    const remaining = bits - i * 16;
    if (remaining <= 0) break;
    const mask = remaining >= 16 ? 0xffff : (0xffff << (16 - remaining)) & 0xffff;
    if ((groups[i] & mask) !== (prefix[i] & mask)) return false;
  }
  return true;
}

function v6Blocked(ip: string): boolean {
  const groups = expandV6(ip);
  if (groups === null) return true;

  // Both embed an IPv4 address in their last 32 bits, so the v4 rules decide it.
  const isMapped = hasPrefix(groups, [0, 0, 0, 0, 0, 0xffff], 96);
  const isNat64 = hasPrefix(groups, [0x64, 0xff9b, 0, 0, 0, 0], 96);
  if (isMapped || isNat64) {
    const embedded = `${groups[6] >>> 8}.${groups[6] & 0xff}.${groups[7] >>> 8}.${groups[7] & 0xff}`;
    return v4Blocked(embedded);
  }

  return BLOCKED_V6.some(([prefix, bits]) => hasPrefix(groups, prefix, bits));
}

/** True when this address is anything other than a routable public one. */
export function isBlockedAddress(ip: string): boolean {
  const bare = ip.replace(/^\[|\]$/g, "").split("%")[0];
  if (isIPv4(bare)) return v4Blocked(bare);
  if (isIP(bare) === 6) return v6Blocked(bare);
  return true; // not an address at all
}

export interface UrlVerdict {
  ok: boolean;
  /** Why it was refused, in a form fit for a job log line. */
  reason?: string;
}

const ALLOWED: UrlVerdict = { ok: true };

// allSettled, not all: resolve6 throws ENODATA for an A-only host, which is an answer not a failure.
async function resolveAll(hostname: string): Promise<string[]> {
  const resolver = new Resolver({ timeout: DNS_TIMEOUT_MS, tries: 2 });
  const settled = await Promise.allSettled([resolver.resolve4(hostname), resolver.resolve6(hostname)]);
  return settled.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
}

/** Whether the crawler may fetch this URL. EVERY resolved address must be public, not merely one. */
export async function checkUrl(raw: string): Promise<UrlVerdict> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: "refused: not a URL" };
  }

  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    return { ok: false, reason: `refused: ${url.protocol} is not a fetchable scheme` };
  }

  const hostname = url.hostname
    .replace(/^\[|\]$/g, "")
    .toLowerCase()
    .replace(/\.$/, "");
  if (!hostname) return { ok: false, reason: "refused: no host" };
  if (BLOCKED_SUFFIXES.some((s) => hostname === s || hostname.endsWith(s))) {
    return { ok: false, reason: `refused: ${hostname} is a local name` };
  }

  // A literal address needs no lookup, and must not get one — DNS would not be consulted anyway.
  if (isIP(hostname)) {
    return isBlockedAddress(hostname) ? { ok: false, reason: `refused: ${hostname} is not a public address` } : ALLOWED;
  }

  // No answers covers NXDOMAIN, timeout and refusal alike — none is a reason to be permissive.
  const addresses = await resolveAll(hostname);
  if (addresses.length === 0) return { ok: false, reason: `refused: ${hostname} did not resolve` };

  const blocked = addresses.find(isBlockedAddress);
  if (blocked) return { ok: false, reason: `refused: ${hostname} resolves to ${blocked}` };

  return ALLOWED;
}
