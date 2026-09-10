import ExcelJS from "exceljs";
import OpenAI from "openai";
import { requireKey } from "@/server/config";
import { JobStatus, prisma } from "@/server/db";
import { reverseGeocode } from "@/server/geocode";
import { STALE_AFTER_MS, staleCutoff } from "@/server/retention";

/* Deliberately small: the search term and summary prompt are constants in config.ts, and the API keys never leave the server. */
export interface Payload {
  latitude: number;
  longitude: number;
  rivers: string[];
  /** When false the OpenAI call is skipped entirely and the crawled text is returned as-is. */
  summarize: boolean;
  /** When false the workbook is never built. The shop phase still runs — the report phase needs its fishingReport flags. */
  shopDirectory: boolean;
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

/** Every output the pipeline can write, keyed by the DB column that holds it. */
export const OUTPUT_FILES = {
  "report_summary.txt": { column: "primaryFile", contentType: "text/plain; charset=utf-8" },
  "shop_details.xlsx": { column: "secondaryFile", contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
  "report_raw.txt": { column: "rawFile", contentType: "text/plain; charset=utf-8" },
} as const;

export type OutputName = keyof typeof OUTPUT_FILES;
export type OutputColumn = (typeof OUTPUT_FILES)[OutputName]["column"];

// Object.hasOwn, not `in`: `"__proto__" in OUTPUT_FILES` is true via the prototype chain, which would pass this allow-list.
export const isOutputName = (name: string): name is OutputName => Object.hasOwn(OUTPUT_FILES, name);

/* One reader per blob column, exhaustive via `satisfies` — the switch this replaces ended in `default`, quietly serving the workbook for anything new. Each selects a single column. */
const readColumn = {
  primaryFile: async (id: string) => (await prisma.job.findUnique({ where: { id }, select: { primaryFile: true } }))?.primaryFile ?? null,
  secondaryFile: async (id: string) => (await prisma.job.findUnique({ where: { id }, select: { secondaryFile: true } }))?.secondaryFile ?? null,
  rawFile: async (id: string) => (await prisma.job.findUnique({ where: { id }, select: { rawFile: true } }))?.rawFile ?? null,
} satisfies Record<OutputColumn, (id: string) => Promise<Uint8Array | null>>;

/** What a run promises to hand back, so the panel can show rows before the bytes exist and download nothing the caller did not ask for. report_raw.txt is not here: it is the catalog's record of what a summary was built from, not a deliverable. */
export function expectedOutputs(job: { shopDirectory: boolean }): OutputName[] {
  return job.shopDirectory ? ["report_summary.txt", "shop_details.xlsx"] : ["report_summary.txt"];
}

/** Builds the shop directory workbook. Emoji conversion happens here and only here — SiteInfo keeps the flags as booleans everywhere else. */
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

/* The SDK's timeout aborts the request, unlike the Promise.race it replaces, which left it running and billable. It also retries 429/5xx and honors Retry-After. */
const OPENAI_TIMEOUT_MS = 90_000;
const OPENAI_MAX_RETRIES = 2;

export const STALE_MESSAGE = "[!!] This run stopped without finishing — the server was likely restarted mid-run. Start a new one.";

// A run writes one line per shop and per crawled page, so a big raw-mode crawl reaches thousands.
const MAX_LOG_LINES = 500;

export const TRUNCATED_MESSAGE = `[??] Earlier lines dropped — showing the last ${MAX_LOG_LINES}.`;

/** A job still marked in-flight that nothing has stamped since the cutoff: its process is gone. */
export function isStale(job: { status: JobStatus; heartbeatAt: Date }, now: number = Date.now()): boolean {
  return job.status === JobStatus.IN_PROGRESS && now - job.heartbeatAt.getTime() > STALE_AFTER_MS;
}

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

  /** Stores what the run was for, never who asked: the rate limiter's IP hash lives on RunLedger. */
  static async create(payload: Payload): Promise<JobHandler> {
    const job = await prisma.job.create({
      data: {
        status: JobStatus.IN_PROGRESS,
        latitude: payload.latitude,
        longitude: payload.longitude,
        rivers: payload.rivers,
        summarized: payload.summarize,
        shopDirectory: payload.shopDirectory,
      },
    });
    return new JobHandler(job.id, payload);
  }

  /* Swallows everything: the label is cosmetic, the catalog falls back to coordinates, and this runs alongside the shop phase where a rejection would surface unhandled. */
  async resolveLocationName(): Promise<void> {
    try {
      const name = await reverseGeocode(this.payload.latitude, this.payload.longitude);
      // updateMany, not update: a row deleted mid-run is a no-op here rather than a thrown P2025 logged as if it mattered.
      if (name) await prisma.job.updateMany({ where: { id: this.id }, data: { locationName: name } });
    } catch (err) {
      console.error(`Flybox job ${this.id} could not resolve a location name:`, err);
    }
  }

  /** Only an in-flight job can be canceled — an unconditional update would turn a COMPLETED job into CANCELED and discard its outputs. */
  static async cancel(id: string) {
    const { count } = await prisma.job.updateMany({
      where: { id, status: JobStatus.IN_PROGRESS },
      data: { status: JobStatus.CANCELED },
    });
    return { canceled: count > 0 };
  }

  /* Polled every 2s, so the blobs are NOT selected here — base64-encoding a multi-hundred-KB xlsx dominated both the query and the response. Readiness is a boolean. */
  static async getUpdates(id: string) {
    const [rows, messages] = await Promise.all([
      prisma.$queryRaw<
        { status: JobStatus; createdAt: Date; heartbeatAt: Date; shopDirectory: boolean; hasPrimary: boolean; hasSecondary: boolean; hasRaw: boolean }[]
      >`
        SELECT "status", "createdAt", "heartbeatAt", "shopDirectory",
               ("primaryFile"   IS NOT NULL) AS "hasPrimary",
               ("secondaryFile" IS NOT NULL) AS "hasSecondary",
               ("rawFile"       IS NOT NULL) AS "hasRaw"
        FROM "Job" WHERE "id" = ${id}
      `,
      // Newest first, reversed below: "oldest first, limited" would pin the log to the run's start.
      prisma.jobMessage.findMany({
        where: { jobId: id },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: { message: true },
        take: MAX_LOG_LINES + 1,
      }),
    ]);

    const job = rows[0];
    if (!job) throw new Error(`Job ${id} not found`);

    /* Keyed by column, not output name, so the mapping lives only in OUTPUT_FILES; exhaustive, so adding one is a compile error rather than a file that never reports ready. */
    const ready: Record<OutputColumn, boolean> = { primaryFile: job.hasPrimary, secondaryFile: job.hasSecondary, rawFile: job.hasRaw };
    const expected = expectedOutputs(job);

    // One over the cap was read, so a full page means something was left behind.
    const truncated = messages.length > MAX_LOG_LINES;
    const lines = messages
      .slice(0, MAX_LOG_LINES)
      .reverse()
      .map((m) => m.message);
    if (truncated) lines.unshift(TRUNCATED_MESSAGE);

    let status = job.status;

    // Whoever polls an abandoned run is the only one who will ever ask about it, so the poll retires it. db_cleanup catches the unwatched.
    if (isStale(job)) {
      status = JobStatus.FAILED;
      if (await JobHandler.retire(id)) await prisma.jobMessage.create({ data: { jobId: id, message: STALE_MESSAGE } });
      lines.push(STALE_MESSAGE);
    }

    return {
      message: lines.join("\n"),
      status,
      createdAt: job.createdAt.toISOString(),
      expected,
      files: expected.filter((name) => ready[OUTPUT_FILES[name].column]).map((name) => ({ name })),
    };
  }

  /** Re-checks the stamp, so concurrent pollers cannot both log the explanation and a run that turns out alive keeps its real outcome. */
  private static async retire(id: string): Promise<boolean> {
    const { count } = await prisma.job.updateMany({
      where: { id, status: JobStatus.IN_PROGRESS, heartbeatAt: { lt: staleCutoff() } },
      data: { status: JobStatus.FAILED },
    });
    return count > 0;
  }

  static getFile(id: string, name: OutputName): Promise<Uint8Array | null> {
    return readColumn[OUTPUT_FILES[name].column](id);
  }

  log(message: string) {
    return prisma.jobMessage.create({ data: { jobId: this.id, message } });
  }

  /* Called per shop and per crawled page, so the answer is cached briefly. CANCELED is terminal, so once seen it is never re-queried. */
  private canceled = false;
  private canceledCheckedAt = 0;

  async isCanceled() {
    if (this.canceled) return true;
    const now = Date.now();
    if (now - this.canceledCheckedAt < JobHandler.CANCEL_TTL_MS) return false;
    this.canceledCheckedAt = now;
    // Stamps the heartbeat in the round trip the check already made. UPDATE..RETURNING, not job.update: a row deleted mid-run must read as not-canceled, not throw.
    const rows = await prisma.$queryRaw<{ status: JobStatus }[]>`
      UPDATE "Job" SET "heartbeatAt" = now() WHERE "id" = ${this.id} RETURNING "status"
    `;
    this.canceled = rows[0]?.status === JobStatus.CANCELED;
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

  /** The crawled source text. Written on summarized runs only — in raw mode primaryFile already is this text. */
  async saveRawText(raw: string) {
    await prisma.job.update({ where: { id: this.id }, data: { rawFile: new Uint8Array(Buffer.from(raw, "utf-8")) } });
  }

  /** Only from IN_PROGRESS, like fail(): isCanceled() caches for 1.5s, so a cancel can land after the last check. */
  async complete() {
    await prisma.job.updateMany({
      where: { id: this.id, status: JobStatus.IN_PROGRESS },
      data: { status: JobStatus.COMPLETED },
    });
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
