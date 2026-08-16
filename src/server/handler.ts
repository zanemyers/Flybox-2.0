import ExcelJS from "exceljs";
import OpenAI from "openai";
import { requireKey } from "@/server/config";
import { JobStatus, prisma } from "@/server/db";

/* Deliberately small. The search term and summary prompt are server-side
   constants (see config.ts) because Flybox funds its own keys, and the API keys
   themselves never leave the server. */
export interface Payload {
  latitude: number;
  longitude: number;
  rivers: string[];
  /** When false the OpenAI call is skipped entirely and the crawled text is returned as-is. */
  summarize: boolean;
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

// Object.hasOwn, not `in`: `"__proto__" in OUTPUT_FILES` is true via the
// prototype chain, which would let a bogus name past this allow-list.
export const isOutputName = (name: string): name is OutputName => Object.hasOwn(OUTPUT_FILES, name);

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

/* The SDK's own timeout aborts the underlying request, unlike the hand-rolled
   Promise.race it replaces, which left the request running and billable. It also
   retries 429/5xx with backoff and honors Retry-After, so the pipeline does not
   need to parse error strings to work out how long to wait. */
const OPENAI_TIMEOUT_MS = 90_000;
const OPENAI_MAX_RETRIES = 2;

export class JobHandler {
  private static readonly CANCEL_TTL_MS = 1_500;

  #client: OpenAI | null = null;

  /** Lazily built so a raw-text run does not require OPENAI_API_KEY at all. */
  get ai(): OpenAI {
    this.#client ??= new OpenAI({
      apiKey: requireKey("OPENAI_API_KEY"),
      timeout: OPENAI_TIMEOUT_MS,
      maxRetries: OPENAI_MAX_RETRIES,
    });
    return this.#client;
  }

  constructor(
    readonly id: string,
    readonly payload: Payload,
  ) {}

  /** clientHash is the salted IP hash used for rate limiting; the raw address
      is never stored. Null when no client address could be determined. */
  static async create(payload: Payload, clientHash: string | null = null): Promise<JobHandler> {
    const job = await prisma.job.create({ data: { status: JobStatus.IN_PROGRESS, clientHash } });
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

  /* Called between every shop and every crawled page, so the result is cached
     briefly: an uncached check was one DB round-trip per item. CANCELED is
     terminal, so once seen it is never re-queried. */
  private canceled = false;
  private canceledCheckedAt = 0;

  async isCanceled() {
    if (this.canceled) return true;
    const now = Date.now();
    if (now - this.canceledCheckedAt < JobHandler.CANCEL_TTL_MS) return false;
    this.canceledCheckedAt = now;
    const job = await prisma.job.findUnique({ where: { id: this.id }, select: { status: true } });
    this.canceled = job?.status === JobStatus.CANCELED;
    return this.canceled;
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
