import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { JobStatus } from "@/server/db";
import type { SiteInfo } from "@/server/handler";
import { buildShopWorkbook, expectedOutputs, isOutputName, isStale, OUTPUT_FILES, SHOP_COLUMNS } from "@/server/handler";
import { STALE_AFTER_MS } from "@/server/retention";

const SAMPLE_SHOP: SiteInfo = {
  name: "Trout & About Fly Shop",
  website: "https://troutandabout.com",
  address: "123 River Rd, Bozeman, MT 59715",
  phone: "406-555-0100",
  stars: "4.8",
  reviews: "120",
  category: "Sporting Goods Store",
  email: "info@troutandabout.com",
  sellsOnline: true,
  fishingReport: true,
  socialMedia: ["Facebook", "Instagram"],
};

/** Reads a generated workbook back so assertions can inspect real cell values
    rather than buffer lengths. */
async function loadSheet(buffer: Buffer) {
  const wb = new ExcelJS.Workbook();
  // exceljs's type declarations globally augment `Buffer extends ArrayBuffer`,
  // creating a phantom mismatch with real Node Buffers. Runtime is fine.
  // biome-ignore lint/suspicious/noExplicitAny: exceljs type-declaration bug
  await wb.xlsx.load(buffer as any);
  return wb.worksheets[0];
}

const cells = (row: ExcelJS.Row) => (row.values as unknown[]).slice(1); // ExcelJS pads index 0

// ── buildShopWorkbook ──────────────────────────────────────────────────────────

describe("buildShopWorkbook", () => {
  it("writes the header row in the documented column order", async () => {
    const sheet = await loadSheet(await buildShopWorkbook([]));
    expect(cells(sheet.getRow(1))).toEqual([...SHOP_COLUMNS]);
  });

  it("writes only a header row when there are no shops", async () => {
    const sheet = await loadSheet(await buildShopWorkbook([]));
    expect(sheet.rowCount).toBe(1);
  });

  it("names the worksheet Shops", async () => {
    const sheet = await loadSheet(await buildShopWorkbook([SAMPLE_SHOP]));
    expect(sheet.name).toBe("Shops");
  });

  it("bolds the header row", async () => {
    const sheet = await loadSheet(await buildShopWorkbook([SAMPLE_SHOP]));
    expect(sheet.getRow(1).font?.bold).toBe(true);
  });

  it("writes every scalar field into its own column", async () => {
    const sheet = await loadSheet(await buildShopWorkbook([SAMPLE_SHOP]));
    const row = cells(sheet.getRow(2));
    expect(row[0]).toBe(SAMPLE_SHOP.name);
    expect(row[2]).toBe(SAMPLE_SHOP.address);
    expect(row[3]).toBe(SAMPLE_SHOP.phone);
    expect(row[4]).toBe(SAMPLE_SHOP.stars);
    expect(row[5]).toBe(SAMPLE_SHOP.reviews);
    expect(row[6]).toBe(SAMPLE_SHOP.category);
  });

  it("converts true booleans to ✅ in the Sells Online and Fishing Report cells", async () => {
    const sheet = await loadSheet(await buildShopWorkbook([SAMPLE_SHOP]));
    const row = sheet.getRow(2);
    expect(row.getCell(9).value).toBe("✅");
    expect(row.getCell(10).value).toBe("✅");
  });

  it("converts false booleans to ❌", async () => {
    const offline: SiteInfo = { ...SAMPLE_SHOP, sellsOnline: false, fishingReport: false };
    const sheet = await loadSheet(await buildShopWorkbook([offline]));
    const row = sheet.getRow(2);
    expect(row.getCell(9).value).toBe("❌");
    expect(row.getCell(10).value).toBe("❌");
  });

  it("serializes socialMedia as a comma-separated string", async () => {
    const sheet = await loadSheet(await buildShopWorkbook([SAMPLE_SHOP]));
    expect(sheet.getRow(2).getCell(11).value).toBe("Facebook, Instagram");
  });

  it("writes an empty Social Media cell when there are no profiles", async () => {
    const sheet = await loadSheet(await buildShopWorkbook([{ ...SAMPLE_SHOP, socialMedia: [] }]));
    const value = sheet.getRow(2).getCell(11).value;
    expect(value === null || value === "").toBe(true);
  });

  it("writes one row per shop, in order", async () => {
    const shops = [SAMPLE_SHOP, { ...SAMPLE_SHOP, name: "Second Shop" }, { ...SAMPLE_SHOP, name: "Third Shop" }];
    const sheet = await loadSheet(await buildShopWorkbook(shops));
    expect(sheet.rowCount).toBe(4); // header + 3
    expect(sheet.getRow(2).getCell(1).value).toBe("Trout & About Fly Shop");
    expect(sheet.getRow(3).getCell(1).value).toBe("Second Shop");
    expect(sheet.getRow(4).getCell(1).value).toBe("Third Shop");
  });

  it("preserves the website as a string rather than coercing it to a hyperlink object", async () => {
    const sheet = await loadSheet(await buildShopWorkbook([SAMPLE_SHOP]));
    expect(sheet.getRow(2).getCell(2).value).toBe(SAMPLE_SHOP.website);
  });

  it("returns a Buffer with XLSX (ZIP) magic bytes", async () => {
    const buf = await buildShopWorkbook([SAMPLE_SHOP]);
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf[0]).toBe(0x50);
    expect(buf[1]).toBe(0x4b);
  });
});

// ── output file allow-list ─────────────────────────────────────────────────────

describe("isOutputName", () => {
  it("accepts every real output name", () => {
    for (const name of ["report_summary.txt", "shop_details.xlsx", "report_raw.txt"]) {
      expect(isOutputName(name)).toBe(true);
    }
  });

  it("rejects anything else, including traversal attempts", () => {
    for (const name of ["", "other.txt", "../../etc/passwd", "report_summary.txt.bak", "REPORT_SUMMARY.TXT", "__proto__"]) {
      expect(isOutputName(name)).toBe(false);
    }
  });

  it("maps each output to a distinct DB column and a sensible content type", () => {
    expect(OUTPUT_FILES["report_summary.txt"].column).toBe("primaryFile");
    expect(OUTPUT_FILES["shop_details.xlsx"].column).toBe("secondaryFile");
    expect(OUTPUT_FILES["report_raw.txt"].column).toBe("rawFile");
    expect(OUTPUT_FILES["report_summary.txt"].contentType).toContain("text/plain");
    expect(OUTPUT_FILES["shop_details.xlsx"].contentType).toContain("spreadsheet");
  });
});

// ── isStale ────────────────────────────────────────────────────────────────────

describe("isStale", () => {
  const NOW = Date.UTC(2026, 7, 21, 12, 0, 0);
  const beat = (msAgo: number) => new Date(NOW - msAgo);

  it("leaves a run alone while its heartbeat is current", () => {
    expect(isStale({ status: JobStatus.IN_PROGRESS, heartbeatAt: beat(0) }, NOW)).toBe(false);
    expect(isStale({ status: JobStatus.IN_PROGRESS, heartbeatAt: beat(60_000) }, NOW)).toBe(false);
  });

  it("holds off right up to the threshold", () => {
    expect(isStale({ status: JobStatus.IN_PROGRESS, heartbeatAt: beat(STALE_AFTER_MS) }, NOW)).toBe(false);
    expect(isStale({ status: JobStatus.IN_PROGRESS, heartbeatAt: beat(STALE_AFTER_MS + 1) }, NOW)).toBe(true);
  });

  it("clears the longest silence a live run can have — a full summarization retry sequence", () => {
    // 90s timeout x 3 attempts, twice if the fallback model also has to run.
    expect(isStale({ status: JobStatus.IN_PROGRESS, heartbeatAt: beat(2 * 3 * 90_000) }, NOW)).toBe(false);
  });

  /* The reaper must never touch a job that already reached a terminal state:
     COMPLETED runs sit in the catalog for as long as retention allows, and their
     heartbeat stops the moment they finish. */
  it("never reaps a job that already finished, however old", () => {
    const ancient = beat(400 * 24 * 3_600_000);
    for (const status of [JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELED]) {
      expect(isStale({ status, heartbeatAt: ancient }, NOW)).toBe(false);
    }
  });
});

// ── expectedOutputs ────────────────────────────────────────────────────────────

describe("expectedOutputs", () => {
  it("promises the report either way", () => {
    expect(expectedOutputs({ shopDirectory: true })).toContain("report_summary.txt");
    expect(expectedOutputs({ shopDirectory: false })).toContain("report_summary.txt");
  });

  it("adds the workbook only when it was asked for", () => {
    expect(expectedOutputs({ shopDirectory: true })).toEqual(["report_summary.txt", "shop_details.xlsx"]);
    expect(expectedOutputs({ shopDirectory: false })).toEqual(["report_summary.txt"]);
  });

  /* report_raw.txt is the catalog's record of what a summary was built from, not
     something the caller asked for — auto-downloading it was the defect here. */
  it("never promises the raw source text", () => {
    for (const shopDirectory of [true, false]) {
      expect(expectedOutputs({ shopDirectory })).not.toContain("report_raw.txt");
    }
  });

  it("names only real outputs, so every row can be downloaded", () => {
    for (const shopDirectory of [true, false]) {
      for (const name of expectedOutputs({ shopDirectory })) expect(isOutputName(name)).toBe(true);
    }
  });
});
