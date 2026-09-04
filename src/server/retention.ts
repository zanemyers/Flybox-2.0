/* One home for every window a run's data lives by, so the pruner and the pages it prunes for cannot disagree. Imports nothing on purpose: scripts/db_cleanup.ts reads these without loading the app. */

/** Completed runs kept with their files. /runs lists exactly these. */
export const CATALOG_LIMIT = 15;

/** Longest window a per-client cap counts against; past it the hash identifies a visitor for no reason. */
export const CLIENT_HASH_TTL_MS = 24 * 60 * 60_000;

/** Ledger hashes past every per-client window. The row survives to be counted; the hash does not. */
export const clientHashCutoff = () => new Date(Date.now() - CLIENT_HASH_TTL_MS);

/* THE window every cap counts over AND the one the ledger is pruned by. One constant for both: a limit can only be as long as its evidence. */
export const RATE_LIMIT_WINDOW_MS = 30 * 24 * 60 * 60_000;

/** Ledger rows past the longest window any cap counts over. Nothing reads them again. */
export const ledgerCutoff = () => new Date(Date.now() - RATE_LIMIT_WINDOW_MS);

/** Liveness, not age: a raw-mode crawl of one large site has no tight ceiling, so total age cannot tell a dead run from a slow one. */
export const STALE_AFTER_MS = 15 * 60_000;

/** A run not stamped since this has no process left to finish it. The floor is one summarization retry sequence: 90s x 3 attempts, twice if it falls back. */
export const staleCutoff = () => new Date(Date.now() - STALE_AFTER_MS);
