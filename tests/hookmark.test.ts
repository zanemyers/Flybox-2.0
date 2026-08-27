/* The hook is drawn twice: as a component in brand.tsx, and as a standalone file in app/icon.svg.
   They cannot be one file — the component needs currentColor and data-theme, the favicon needs
   literal colors and prefers-color-scheme — so this pins the geometry they DO have to share. */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

const BRAND = read("../src/client/components/brand.tsx");
const ICON = read("../src/app/icon.svg");

/** brand.tsx holds two drawings, and ContourField has paths of its own. */
function hookMarkSource(source: string): string {
  const start = source.indexOf("export function HookMark");
  expect(start, "HookMark not found in brand.tsx").toBeGreaterThan(-1);
  const next = source.indexOf("export function", start + 1);
  return source.slice(start, next === -1 ? undefined : next);
}

/** Every `d` attribute, in document order. */
const paths = (svg: string) => [...svg.matchAll(/\sd="([^"]+)"/g)].map((m) => m[1]);

/** The eye, as cx/cy/r. Both files spell the attributes the same way; only strokeWidth differs. */
function eye(svg: string): { cx: string; cy: string; r: string } | null {
  const tag = /<circle\b[^>]*>/.exec(svg)?.[0];
  if (!tag) return null;
  const attr = (name: string) => new RegExp(`\\b${name}="([^"]+)"`).exec(tag)?.[1] ?? "";
  return { cx: attr("cx"), cy: attr("cy"), r: attr("r") };
}

describe("the hook is drawn the same in brand.tsx and app/icon.svg", () => {
  const hook = hookMarkSource(BRAND);

  it("draws the shank and the barb, in that order", () => {
    expect(paths(hook)).toHaveLength(2);
  });

  it("uses identical path geometry in both files", () => {
    expect(paths(ICON)).toEqual(paths(hook));
  });

  it("places the eye identically in both files", () => {
    expect(eye(ICON)).toEqual(eye(hook));
    expect(eye(hook)).not.toBeNull();
  });

  /* The favicon has no CSS context, so currentColor would resolve to nothing. Both theme values are
     inlined instead, and they must stay the two --color-primary values from globals.css. */
  it("inlines both primary colors, since the favicon cannot inherit one", () => {
    expect(ICON).toContain("#0d667a");
    expect(ICON).toContain("#6bbbd2");
    expect(ICON).toContain("prefers-color-scheme: dark");
  });

  /* The component is the opposite: it must NOT hardcode a color, or the submit button's hook stops
     inheriting the cream primary-content and renders teal on a teal fill. */
  it("leaves the component's color to currentColor", () => {
    expect(hook).toContain('stroke="currentColor"');
    expect(hook).not.toMatch(/#[0-9a-f]{6}/i);
  });
});
