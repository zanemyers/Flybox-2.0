// needsPlaywright gates a stealth Chromium load per shop; `refused` must never open that gate.

import { describe, expect, it } from "vitest";
import { type FetchResult, needsPlaywright } from "@/server/browser";

const result = (over: Partial<FetchResult> = {}): FetchResult => ({
  html: "<html><body>Caddis</body></html>",
  status: 200,
  blocked: false,
  jsRendered: false,
  ...over,
});

describe("needsPlaywright", () => {
  it("leaves a good HTTP response alone", () => {
    expect(needsPlaywright(result())).toBe(false);
  });

  it("escalates a blocked response", () => {
    expect(needsPlaywright(result({ html: null, status: 403, blocked: true }))).toBe(true);
  });

  it("escalates a JS shell", () => {
    expect(needsPlaywright(result({ jsRendered: true }))).toBe(true);
  });

  it("escalates a transport failure", () => {
    expect(needsPlaywright(result({ html: null, status: 0, error: "fetch failed" }))).toBe(true);
  });

  it("never escalates a refusal, however it also looks", () => {
    expect(needsPlaywright(result({ html: null, status: 0, refused: true, error: "refused: 127.0.0.1" }))).toBe(false);
    // refused wins over every other reason to escalate, so a declined URL cannot sneak back in.
    expect(needsPlaywright(result({ html: null, blocked: true, jsRendered: true, refused: true }))).toBe(false);
  });
});
