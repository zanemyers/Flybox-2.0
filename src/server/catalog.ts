import { JobStatus, prisma } from "@/server/db";
import { CATALOG_LIMIT } from "@/server/retention";

/** How many of the listed runs show a snippet inline. Display only — retention lives in retention.ts. */
export const DETAILED_RUNS = 5;

const SNIPPET_CHARS = 420;

/* Generous head: the separator strip below can eat most of what it reads, and a
   byte cut can land mid-character, so take far more than SNIPPET_CHARS needs. */
const SNIPPET_HEAD_BYTES = 4_000;

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
    .replace(/\uFFFD+$/, "")
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
  head: Uint8Array | null;
}

export async function recentRuns(): Promise<CatalogRun[]> {
  /* One round trip, not two: readiness is asked of the database, and only the newest rows detoast a bounded head for the preview. */
  /* The id tiebreaker must match db_cleanup's, or a tie at the boundary lets this list a run the pruner deleted. */
  const rows = await prisma.$queryRaw<Row[]>`
    SELECT "id", "createdAt", "locationName", "latitude", "longitude", "rivers", "summarized",
           ("primaryFile"   IS NOT NULL) AS "hasSummary",
           ("rawFile"       IS NOT NULL) AS "hasRaw",
           ("secondaryFile" IS NOT NULL) AS "hasShops",
           CASE WHEN row_number() OVER (ORDER BY "createdAt" DESC, "id" DESC) <= ${DETAILED_RUNS}
                THEN substring("primaryFile" from 1 for ${SNIPPET_HEAD_BYTES})
           END AS "head"
    FROM "Job"
    WHERE "status" = ${JobStatus.COMPLETED}::"JobStatus"
    ORDER BY "createdAt" DESC, "id" DESC
    LIMIT ${CATALOG_LIMIT}
  `;

  return rows.map(({ head, ...r }, i) => ({
    ...r,
    detailed: i < DETAILED_RUNS,
    snippet: toSnippet(head),
  }));
}
