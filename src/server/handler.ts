import ExcelJS from "exceljs";
import OpenAI from "openai";
import { requireKey } from "@/server/config";
import { JobStatus, prisma } from "@/server/db";
import { reverseGeocode } from "@/server/geocode";
import { STALE_AFTER_MS, staleCutoff } from "@/server/retention";

/* Deliberately small. The search term and summary prompt are server-side
   constants (see config.ts) because Flybox funds its own keys, and the API keys
   themselves never leave the server. */
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

// Object.hasOwn, not `in`: `"__proto__" in OUTPUT_FILES` is true via the
// prototype chain, which would let a bogus name past this allow-list.
export const isOutputName = (name: string): name is OutputName => Object.hasOwn(OUTPUT_FILES, name);

/* One reader per blob column. `satisfies` makes it exhaustive, so a column added to OUTPUT_FILES will not compile until
   it has one here — where the switch this replaces ended in `default`, quietly serving the workbook for anything new.
   Each still selects a single column: pulling all three to return one is what keeping blobs out of queries was about. */
const readColumn = {
  primaryFile: async (id: string) => (await prisma.job.findUnique({ where: { id }, select: { primaryFile: true } }))?.primaryFile ?? null,
  secondaryFile: async (id: string) => (await prisma.job.findUnique({ where: { id }, select: { secondaryFile: true } }))?.secondaryFile ?? null,
  rawFile: async (id: string) => (await prisma.job.findUnique({ where: { id }, select: { rawFile: true } }))?.rawFile ?? null,
} satisfies Record<OutputColumn, (id: string) => Promise<Uint8Array | null>>;

/** What a run promises to hand back, so the panel can show rows before the bytes exist and download nothing the caller did not ask for. report_raw.txt is not here: it is the catalog's record of what a summary was built from, not a deliverable. */
export function expectedOutputs(job: { shopDirectory: boolean }): OutputName[] {
  return job.shopDirectory ? ["report_summary.txt", "shop_details.xlsx"] : ["report_summary.txt"];
}

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

export const STALE_MESSAGE = "[!!] This run stopped without finishing — the server was likely restarted mid-run. Start a new one.";

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

  /** clientHash is the salted IP hash used for rate limiting; the raw address
      is never stored. Null when no client address could be determined. */
  static async create(payload: Payload, clientHash: string | null = null): Promise<JobHandler> {
    const job = await prisma.job.create({
      data: {
        status: JobStatus.IN_PROGRESS,
        clientHash,
        latitude: payload.latitude,
        longitude: payload.longitude,
        rivers: payload.rivers,
        summarized: payload.summarize,
        shopDirectory: payload.shopDirectory,
      },
    });
    return new JobHandler(job.id, payload);
  }

  /* Names the coordinates for the catalog. Deliberately swallows everything: the label is cosmetic, the catalog falls
     back to the raw coordinates, and this runs alongside the shop phase where a rejection would surface unhandled. */
  async resolveLocationName(): Promise<void> {
    try {
      const name = await reverseGeocode(this.payload.latitude, this.payload.longitude);
      // updateMany, not update: a row deleted mid-run is a no-op here rather than a thrown P2025 logged as if it mattered.
      if (name) await prisma.job.updateMany({ where: { id: this.id }, data: { locationName: name } });
    } catch (err) {
      console.error(`Flybox job ${this.id} could not resolve a location name:`, err);
    }
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
      prisma.$queryRaw<
        { status: JobStatus; createdAt: Date; heartbeatAt: Date; shopDirectory: boolean; hasPrimary: boolean; hasSecondary: boolean; hasRaw: boolean }[]
      >`
        SELECT "status", "createdAt", "heartbeatAt", "shopDirectory",
               ("primaryFile"   IS NOT NULL) AS "hasPrimary",
               ("secondaryFile" IS NOT NULL) AS "hasSecondary",
               ("rawFile"       IS NOT NULL) AS "hasRaw"
        FROM "Job" WHERE "id" = ${id}
      `,
      prisma.jobMessage.findMany({ where: { jobId: id }, orderBy: { createdAt: "asc" }, select: { message: true } }),
    ]);

    const job = rows[0];
    if (!job) throw new Error(`Job ${id} not found`);

    /* Keyed by column rather than by output name, so the name-to-column mapping exists only in OUTPUT_FILES, and
       exhaustive over the columns, so adding one is a compile error here instead of a file that never reports ready. */
    const ready: Record<OutputColumn, boolean> = { primaryFile: job.hasPrimary, secondaryFile: job.hasSecondary, rawFile: job.hasRaw };
    const expected = expectedOutputs(job);

    const lines = messages.map((m) => m.message);
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

  /** The crawled source text, kept even on summarized runs so the catalog can
      offer both the report and what it was built from. */
  async saveRawText(raw: string) {
    await prisma.job.update({ where: { id: this.id }, data: { rawFile: new Uint8Array(Buffer.from(raw, "utf-8")) } });
  }

  /** Only from IN_PROGRESS, like fail(): isCanceled() caches for 1.5s, so a cancel can land
      after the last check and an unconditional update would relabel it COMPLETED. */
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
