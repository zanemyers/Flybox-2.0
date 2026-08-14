import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import type { SiteInfo } from "@/server/handler";
import { buildShopWorkbook, isOutputName, OUTPUT_FILES, SHOP_COLUMNS } from "@/server/handler";

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
  it("accepts the two real output names", () => {
    expect(isOutputName("report_summary.txt")).toBe(true);
    expect(isOutputName("shop_details.xlsx")).toBe(true);
  });

  it("rejects anything else, including traversal attempts", () => {
    for (const name of ["", "other.txt", "../../etc/passwd", "report_summary.txt.bak", "REPORT_SUMMARY.TXT", "__proto__"]) {
      expect(isOutputName(name)).toBe(false);
    }
  });

  it("maps each output to a distinct DB column and a sensible content type", () => {
    expect(OUTPUT_FILES["report_summary.txt"].column).toBe("primaryFile");
    expect(OUTPUT_FILES["shop_details.xlsx"].column).toBe("secondaryFile");
    expect(OUTPUT_FILES["report_summary.txt"].contentType).toContain("text/plain");
    expect(OUTPUT_FILES["shop_details.xlsx"].contentType).toContain("spreadsheet");
  });
});
