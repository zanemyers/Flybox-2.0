/* One home for every window a run's data lives by, so the pruner and the pages it prunes for cannot disagree. Imports nothing on purpose: scripts/db_cleanup.ts reads these without loading the app. */

/** Completed runs kept with their files. /runs lists exactly these. */
export const CATALOG_LIMIT = 15;

/** Longest window Job.clientHash is counted against; past it the hash identifies a visitor for no reason. */
export const CLIENT_HASH_TTL_MS = 24 * 60 * 60_000;
