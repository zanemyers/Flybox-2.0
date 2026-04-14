import ExcelJS from "exceljs";
import type { SiteInfo } from "@/server/shopPhase";

export class ExcelFileHandler {
  private workbook: ExcelJS.Workbook;
  private sheet: ExcelJS.Worksheet;

  constructor() {
    this.workbook = new ExcelJS.Workbook();
    this.sheet = this.workbook.addWorksheet("Shops");
    this.sheet.addRow([
      "Name",
      "Website",
      "Address",
      "Phone",
      "Stars",
      "Reviews",
      "Category",
      "Email",
      "Sells Online",
      "Fishing Report",
      "Social Media",
    ]);
    this.sheet.getRow(1).font = { bold: true };
  }

  addRow(info: SiteInfo): void {
    this.sheet.addRow([
      info.name,
      info.website,
      info.address,
      info.phone,
      info.stars,
      info.reviews,
      info.category,
      info.email,
      String(info.sellsOnline),
      String(info.fishingReport),
      info.socialMedia.join(", "),
    ]);
  }

  async getBuffer(): Promise<Buffer> {
    return Buffer.from(await this.workbook.xlsx.writeBuffer());
  }
}

export class TXTFileHandler {
  private segments: string[] = [];

  append(text: string): void {
    this.segments.push(text);
  }

  getBuffer(): Buffer {
    return Buffer.from(this.segments.join("\n"), "utf-8");
  }
}
