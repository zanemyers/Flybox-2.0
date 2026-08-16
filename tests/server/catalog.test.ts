/* The catalog's snippet is the only place a report body is rendered inline, so
   these pin the trimming rules. labelFromAddress decides what a run is called. */
import { describe, expect, it } from "vitest";
import { labelFromAddress } from "@/server/geocode";

describe("labelFromAddress", () => {
  it("prefers a named feature over the enclosing county", () => {
    expect(labelFromAddress({ national_park: "Yellowstone National Park", county: "Teton County", state: "Wyoming" })).toBe(
      "Yellowstone National Park, Wyoming",
    );
  });

  it("falls back to the town when there is no feature", () => {
    expect(labelFromAddress({ town: "Ennis", state: "Montana" })).toBe("Ennis, Montana");
  });

  it("prefers city over county", () => {
    expect(labelFromAddress({ city: "Bozeman", county: "Gallatin County", state: "Montana" })).toBe("Bozeman, Montana");
  });

  it("does not repeat itself when the place is the region", () => {
    expect(labelFromAddress({ state: "Wyoming" })).toBe("Wyoming");
  });

  it("uses a lake or river name when that is all there is", () => {
    expect(labelFromAddress({ water: "Hebgen Lake", state: "Montana" })).toBe("Hebgen Lake, Montana");
  });

  it("falls back to the country, then to null", () => {
    expect(labelFromAddress({ country: "United States" })).toBe("United States");
    expect(labelFromAddress({})).toBeNull();
    expect(labelFromAddress(undefined)).toBeNull();
  });
});
