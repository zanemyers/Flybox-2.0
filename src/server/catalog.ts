import { JobStatus, prisma } from "@/server/db";

/* The catalog keeps CATALOG_LIMIT runs, all of them downloadable. The newest
   DETAILED_RUNS additionally show a snippet of the report inline; the rest are
   compact rows. scripts/db_cleanup.ts deletes past CATALOG_LIMIT. */
export const DETAILED_RUNS = 5;
export const CATALOG_LIMIT = 15;

const SNIPPET_CHARS = 420;

export interface CatalogRun {
  id: string;
  createdAt: Date;
  locationName: string | null;
  latitude: number | null;
  longitude: number | null;
  rivers: string[];
  summarized: boolean;
  detailed: boolean;
  snippet: string | null;
  hasSummary: boolean;
  hasRaw: boolean;
  hasShops: boolean;
}

/** Trims to a word boundary and strips the crawler's `--- url ---` separators,
    which are noise in a preview. */
function toSnippet(bytes: Uint8Array | null): string | null {
  if (!bytes?.length) return null;
  const text = Buffer.from(bytes)
    .toString("utf-8")
    // Older runs used the Gemini-era wording; strip both.
    .replace(/^\[(?:Summarization|Gemini) unavailable[^\]]*\]\s*/i, "")
    .replace(/^(====|---) .*$/gm, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return null;
  if (text.length <= SNIPPET_CHARS) return text;
  const cut = text.slice(0, SNIPPET_CHARS);
  return `${cut.slice(0, cut.lastIndexOf(" ") + 1 || cut.length).trimEnd()}…`;
}

interface Row {
  id: string;
  createdAt: Date;
  locationName: string | null;
  latitude: number | null;
  longitude: number | null;
  rivers: string[];
  summarized: boolean;
  hasSummary: boolean;
  hasRaw: boolean;
  hasShops: boolean;
}

export async function recentRuns(): Promise<CatalogRun[]> {
  /* Every listed run offers downloads, so all of them need file readiness — but
     readiness is a boolean, and selecting the blobs to answer it would pull
     megabytes to render a list. Ask the database instead. */
  const rows = await prisma.$queryRaw<Row[]>`
    SELECT "id", "createdAt", "locationName", "latitude", "longitude", "rivers", "summarized",
           ("primaryFile"   IS NOT NULL) AS "hasSummary",
           ("rawFile"       IS NOT NULL) AS "hasRaw",
           ("secondaryFile" IS NOT NULL) AS "hasShops"
    FROM "Job"
    WHERE "status" = ${JobStatus.COMPLETED}::"JobStatus"
    ORDER BY "createdAt" DESC
    LIMIT ${CATALOG_LIMIT}
  `;

  // Only the newest few show a preview, so only those bodies get read.
  const detailedIds = rows.slice(0, DETAILED_RUNS).map((r) => r.id);
  const bodies = detailedIds.length ? await prisma.job.findMany({ where: { id: { in: detailedIds } }, select: { id: true, primaryFile: true } }) : [];
  const snippetById = new Map(bodies.map((b) => [b.id, toSnippet(b.primaryFile)]));

  return rows.map((r, i) => ({
    ...r,
    detailed: i < DETAILED_RUNS,
    snippet: snippetById.get(r.id) ?? null,
  }));
}
