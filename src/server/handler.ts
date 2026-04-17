import { GoogleGenAI } from "@google/genai";
import ExcelJS from "exceljs";
import { JobStatus, prisma } from "@/server/db";

export interface Payload {
  serpApiKey: string;
  geminiApiKey: string;
  searchTerm: string;
  latitude: number;
  longitude: number;
  rivers: string[];
  summaryPrompt: string;
}

export interface SiteInfo {
  name: string;
  website: string;
  address: string;
  phone: string;
  stars: string;
  reviews: string;
  category: string;
  email: string;
  sellsOnline: boolean;
  fishingReport: boolean;
  socialMedia: string[];
}

export class JobHandler {
  readonly xls = new ExcelFileHandler();
  readonly txt = new TXTFileHandler();
  readonly ai: GoogleGenAI;

  constructor(
    readonly id: string,
    readonly payload: Payload,
  ) {
    this.ai = new GoogleGenAI({ apiKey: payload.geminiApiKey });
  }

  static async create(payload: Payload): Promise<JobHandler> {
    const job = await prisma.job.create({ data: { status: JobStatus.IN_PROGRESS } });
    return new JobHandler(job.id, payload);
  }

  static async cancel(id: string) {
    return prisma.job.update({ where: { id }, data: { status: JobStatus.CANCELED } });
  }

  static async getUpdates(id: string) {
    const [job, messages] = await Promise.all([
      prisma.job.findUniqueOrThrow({ where: { id }, select: { status: true, primaryFile: true, secondaryFile: true } }),
      prisma.jobMessage.findMany({ where: { jobId: id }, orderBy: { createdAt: "asc" }, select: { message: true } }),
    ]);

    const files: Array<{ name: string; buffer: string }> = [];
    if (job.primaryFile) files.push({ name: "report_summary.txt", buffer: Buffer.from(job.primaryFile).toString("base64") });
    if (job.secondaryFile) files.push({ name: "shop_details.xlsx", buffer: Buffer.from(job.secondaryFile).toString("base64") });

    return { message: messages.map((m) => m.message).join("\n"), status: job.status, files };
  }

  log(message: string) {
    return prisma.jobMessage.create({ data: { jobId: this.id, message } });
  }

  async isCanceled() {
    const job = await prisma.job.findUnique({ where: { id: this.id }, select: { status: true } });
    return job?.status === JobStatus.CANCELED;
  }

  async saveShops(shops: SiteInfo[]) {
    for (const shop of shops) this.xls.addRow(shop);
    await prisma.job.update({ where: { id: this.id }, data: { secondaryFile: new Uint8Array(await this.xls.getBuffer()) } });
    await this.log(`📊 Shop directory saved (${shops.length} shops).`);
  }

  async saveSummary(summary: string) {
    this.txt.append(summary);
    await prisma.job.update({ where: { id: this.id }, data: { primaryFile: new Uint8Array(this.txt.getBuffer()) } });
    await this.log("📥 Report summary saved.");
  }

  complete() {
    return prisma.job.update({ where: { id: this.id }, data: { status: JobStatus.COMPLETED } });
  }

  async fail(message?: string) {
    await Promise.all([
      message ? this.log(`❌ ${message}`) : Promise.resolve(),
      prisma.job.update({ where: { id: this.id }, data: { status: JobStatus.FAILED } }),
    ]);
  }
}

export class ExcelFileHandler {
  private workbook: ExcelJS.Workbook;
  private sheet: ExcelJS.Worksheet;

  constructor() {
    this.workbook = new ExcelJS.Workbook();
    this.sheet = this.workbook.addWorksheet("Shops");
    this.sheet.addRow(["Name", "Website", "Address", "Phone", "Stars", "Reviews", "Category", "Email", "Sells Online", "Fishing Report", "Social Media"]);
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
      info.sellsOnline ? "✅" : "❌",
      info.fishingReport ? "✅" : "❌",
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
