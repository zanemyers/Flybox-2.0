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

export const SHOP_COLUMNS = [
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
] as const;

/** The two fixed outputs, keyed by the DB column that holds each one. */
export const OUTPUT_FILES = {
  "report_summary.txt": { column: "primaryFile", contentType: "text/plain; charset=utf-8" },
  "shop_details.xlsx": { column: "secondaryFile", contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
} as const;

export type OutputName = keyof typeof OUTPUT_FILES;

export const isOutputName = (name: string): name is OutputName => name in OUTPUT_FILES;

/** Builds the shop directory workbook. Emoji conversion happens here and only
    here — SiteInfo keeps sellsOnline/fishingReport as booleans everywhere else. */
export async function buildShopWorkbook(shops: SiteInfo[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Shops");
  sheet.addRow([...SHOP_COLUMNS]);
  sheet.getRow(1).font = { bold: true };

  for (const info of shops) {
    sheet.addRow([
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

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export class JobHandler {
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

  /** Only an in-flight job can be canceled — an unconditional update would turn
      an already COMPLETED job into CANCELED and discard its outputs. */
  static async cancel(id: string) {
    const { count } = await prisma.job.updateMany({
      where: { id, status: JobStatus.IN_PROGRESS },
      data: { status: JobStatus.CANCELED },
    });
    return { canceled: count > 0 };
  }

  /* Polled every 2s. The file blobs are deliberately NOT selected here: reading
     and base64-encoding a multi-hundred-KB xlsx on every poll dominated both the
     query and the response. Readiness is a boolean; the bytes are served by
     GET /api/flybox/[id]/files/[name]. */
  static async getUpdates(id: string) {
    const [rows, messages] = await Promise.all([
      prisma.$queryRaw<{ status: JobStatus; createdAt: Date; hasPrimary: boolean; hasSecondary: boolean }[]>`
        SELECT "status", "createdAt",
               ("primaryFile"   IS NOT NULL) AS "hasPrimary",
               ("secondaryFile" IS NOT NULL) AS "hasSecondary"
        FROM "Job" WHERE "id" = ${id}
      `,
      prisma.jobMessage.findMany({ where: { jobId: id }, orderBy: { createdAt: "asc" }, select: { message: true } }),
    ]);

    const job = rows[0];
    if (!job) throw new Error(`Job ${id} not found`);

    const files: { name: OutputName }[] = [];
    if (job.hasPrimary) files.push({ name: "report_summary.txt" });
    if (job.hasSecondary) files.push({ name: "shop_details.xlsx" });

    return {
      message: messages.map((m) => m.message).join("\n"),
      status: job.status,
      createdAt: job.createdAt.toISOString(),
      files,
    };
  }

  static async getFile(id: string, name: OutputName): Promise<Uint8Array | null> {
    if (OUTPUT_FILES[name].column === "primaryFile") {
      const job = await prisma.job.findUnique({ where: { id }, select: { primaryFile: true } });
      return job?.primaryFile ?? null;
    }
    const job = await prisma.job.findUnique({ where: { id }, select: { secondaryFile: true } });
    return job?.secondaryFile ?? null;
  }

  log(message: string) {
    return prisma.jobMessage.create({ data: { jobId: this.id, message } });
  }

  async isCanceled() {
    const job = await prisma.job.findUnique({ where: { id: this.id }, select: { status: true } });
    return job?.status === JobStatus.CANCELED;
  }

  async saveShops(shops: SiteInfo[]) {
    const buffer = await buildShopWorkbook(shops);
    await prisma.job.update({ where: { id: this.id }, data: { secondaryFile: new Uint8Array(buffer) } });
    await this.log(`[OK] Shop directory saved (${shops.length} shops).`);
  }

  async saveSummary(summary: string) {
    await prisma.job.update({ where: { id: this.id }, data: { primaryFile: new Uint8Array(Buffer.from(summary, "utf-8")) } });
    await this.log("[OK] Report summary saved.");
  }

  complete() {
    return prisma.job.update({ where: { id: this.id }, data: { status: JobStatus.COMPLETED } });
  }

  /** Never downgrades a CANCELED job to FAILED — a user-initiated stop is not an error. */
  async fail(message?: string) {
    if (message) await this.log(`[!!] ${message}`);
    await prisma.job.updateMany({
      where: { id: this.id, status: JobStatus.IN_PROGRESS },
      data: { status: JobStatus.FAILED },
    });
  }
}
