/* One home for every window a run's data lives by, so the pruner and the pages it prunes for cannot disagree. Imports nothing on purpose: scripts/db_cleanup.ts reads these without loading the app. */

/** Completed runs kept with their files. /runs lists exactly these. */
export const CATALOG_LIMIT = 15;

/** Longest window Job.clientHash is counted against; past it the hash identifies a visitor for no reason. */
export const CLIENT_HASH_TTL_MS = 24 * 60 * 60_000;

/** Liveness, not age: a raw-mode crawl of one large site has no tight ceiling, so total age cannot tell a dead run from a slow one. */
export const STALE_AFTER_MS = 15 * 60_000;

/** A run not stamped since this has no process left to finish it. The floor is one summarization retry sequence: 90s x 3 attempts, twice if it falls back. */
export const staleCutoff = () => new Date(Date.now() - STALE_AFTER_MS);
