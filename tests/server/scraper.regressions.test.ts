/* Regressions for the scraper defects fixed on this branch: substring report detection, and robots.txt case/wildcard handling. */
import { describe, expect, it } from "vitest";
import { isReportPath, parseRobots, robotsMatchLength } from "@/server/scraper";

describe("report path detection — the reported false positives", () => {
  const shouldBeFalse = [
    "/terms-and-conditions",
    "/pages/terms-conditions",
    "/shop/hatchery-supply",
    "/reports/2024-annual-report",
    "/privacy-policy",
    "/shipping-returns",
  ];
  const shouldBeTrue = [
    "/fishing-report",
    "/fishing-report-june",
    "/stream-conditions",
    "/river-conditions",
    "/streamflow",
    "/fly-fishing/reports",
    "/hatch-chart",
  ];
  for (const p of shouldBeFalse) it(`rejects ${p}`, () => expect(isReportPath(p)).toBe(false));
  for (const p of shouldBeTrue) it(`accepts ${p}`, () => expect(isReportPath(p)).toBe(true));
});

function allowed(txt: string, pathname: string) {
  const { rules } = parseRobots(txt);
  let a = -1,
    d = -1;
  for (const r of rules) {
    const len = robotsMatchLength(r.pattern, pathname);
    if (len < 0) continue;
    if (r.allow) a = Math.max(a, len);
    else d = Math.max(d, len);
  }
  return d < 0 || a >= d;
}

describe("robots.txt — the reported case/wildcard bugs", () => {
  it("honors a case-sensitive Disallow", () => {
    expect(allowed("User-agent: *\nDisallow: /Private/", "/Private/secret")).toBe(false);
  });
  it("honors a case-sensitive Allow override", () => {
    expect(allowed("User-agent: *\nDisallow: /\nAllow: /Fishing-Report/", "/Fishing-Report/today")).toBe(true);
  });
  it("supports * wildcards", () => {
    expect(allowed("User-agent: *\nDisallow: /*/report", "/foo/report")).toBe(false);
  });
  it("strips inline comments", () => {
    expect(allowed("User-agent: *\nDisallow: /admin # no bots", "/admin")).toBe(false);
  });
  it("supports the $ anchor", () => {
    expect(allowed("User-agent: *\nDisallow: /page$", "/page")).toBe(false);
    expect(allowed("User-agent: *\nDisallow: /page$", "/page/sub")).toBe(true);
  });
  it("treats consecutive User-agent lines as one group", () => {
    expect(allowed("User-agent: *\nUser-agent: Googlebot\nDisallow: /x", "/x")).toBe(false);
  });
  it("still ignores a Googlebot-only group", () => {
    expect(allowed("User-agent: Googlebot\nDisallow: /\n\nUser-agent: *\nDisallow:", "/page")).toBe(true);
  });
  it("does not leak a later named group into the wildcard group", () => {
    expect(allowed("User-agent: *\nDisallow: /a\nUser-agent: Googlebot\nDisallow: /b", "/b")).toBe(true);
  });
});
