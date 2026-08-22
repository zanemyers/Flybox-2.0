import type { Metadata } from "next";
import { FiDownload, FiFile, FiFileText, FiMapPin } from "react-icons/fi";
import { type CatalogRun, DETAILED_RUNS, recentRuns } from "@/server/catalog";

export const metadata: Metadata = {
  title: "Recent runs — Flybox",
  description: "The most recent Flybox runs, with their reports available to download.",
};

// Reads the jobs table on every request; a cached page would always be stale.
export const dynamic = "force-dynamic";

/* Formatted on the server, so the zone is the server's and not the reader's — UTC on Render. Label it rather than
   implying local time, and carry the exact instant in dateTime for anything reading the page rather than looking at it. */
const fmtDate = (d: Date) =>
  `${d.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC" })} UTC`;

const fmtCoords = (lat: number | null, lon: number | null) => (lat === null || lon === null ? null : `${lat.toFixed(6)}, ${lon.toFixed(6)}`);

function Downloads({ run, compact = false }: { run: CatalogRun; compact?: boolean }) {
  const files = [
    run.hasSummary && { name: "report_summary.txt", label: run.summarized ? "Report" : "Raw text", Icon: FiFileText },
    run.hasRaw && run.summarized && { name: "report_raw.txt", label: "Source text", Icon: FiFileText },
    run.hasShops && { name: "shop_details.xlsx", label: "Shop directory", Icon: FiFile },
  ].filter(Boolean) as { name: string; label: string; Icon: typeof FiFile }[];

  if (!files.length) return null;

  return (
    <ul role="list" className={`ms-0 flex list-none flex-wrap gap-2 ${compact ? "justify-end" : "mt-3"}`}>
      {files.map(({ name, label, Icon }) => (
        <li key={name}>
          <a
            href={`/api/flybox/${run.id}/files/${name}`}
            download={name}
            className={`btn btn-ghost gap-2 border border-stroke ${compact ? "btn-xs h-7" : "btn-sm"}`}
          >
            <Icon className="size-3.5 shrink-0" />
            {label}
            <FiDownload className="size-3.5 shrink-0 opacity-70" />
          </a>
        </li>
      ))}
    </ul>
  );
}

function Location({ run }: { run: CatalogRun }) {
  const coords = fmtCoords(run.latitude, run.longitude);
  return (
    <div className="flex items-start gap-2">
      <FiMapPin className="mt-0.5 size-3.5 shrink-0 text-primary" />
      <div>
        {/* The name is the headline; coordinates are the fine print beneath it.
            When the lookup failed there is no name, so the coordinates take over. */}
        <span className="block font-medium">{run.locationName ?? coords ?? "Unknown location"}</span>
        {run.locationName && coords && <span className="readout block text-micro text-base-content/70">{coords}</span>}
      </div>
    </div>
  );
}

export default async function Runs() {
  const runs = await recentRuns();
  const detailed = runs.filter((r) => r.detailed);
  const rest = runs.filter((r) => !r.detailed);

  return (
    <div className="shell py-12">
      <section>
        <h1>Recent runs</h1>
        <p className="prose-measure mt-3">
          The last {runs.length || "few"} completed runs, all of them downloadable. The newest {DETAILED_RUNS} also show a preview of the report.
        </p>
        <hr />
      </section>

      {runs.length === 0 ? (
        <p className="text-sm text-base-content/70">No completed runs yet. Start one from the home page and it will show up here.</p>
      ) : (
        <>
          <ol role="list" className="ms-0 list-none">
            {detailed.map((run, i) => (
              <li key={run.id} className="border-t border-rule py-6 first:border-t-0 first:pt-0">
                <div className="grid gap-4 md:grid-cols-[2.5rem_minmax(0,1fr)]">
                  <span className="readout text-micro text-mark">{String(i + 1).padStart(2, "0")}</span>
                  <div>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <Location run={run} />
                      <div className="flex shrink-0 items-center gap-2">
                        {!run.summarized && <span className="chip border-rule text-base-content/70">Raw</span>}
                        <time dateTime={run.createdAt.toISOString()} className="readout text-micro text-base-content/70">
                          {fmtDate(run.createdAt)}
                        </time>
                      </div>
                    </div>

                    {run.rivers.length > 0 && (
                      <p className="mt-2 flex flex-wrap gap-1.5">
                        {run.rivers.map((r) => (
                          <span key={r} className="tag">
                            {r}
                          </span>
                        ))}
                      </p>
                    )}

                    {run.snippet && <p className="well prose-measure mt-3 font-mono text-xs leading-[1.6] text-base-content/70">{run.snippet}</p>}

                    <Downloads run={run} />
                  </div>
                </div>
              </li>
            ))}
          </ol>

          {rest.length > 0 && (
            <section className="mt-10">
              <h2 className="eyebrow">Earlier</h2>
              <hr className="my-2" />
              <ul role="list" className="ms-0 list-none divide-y divide-rule">
                {rest.map((run) => (
                  <li key={run.id} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 py-3">
                    <div className="min-w-0">
                      <Location run={run} />
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <div className="flex items-center gap-2">
                        {!run.summarized && <span className="chip border-rule text-base-content/70">Raw</span>}
                        <time dateTime={run.createdAt.toISOString()} className="readout text-micro text-base-content/70">
                          {fmtDate(run.createdAt)}
                        </time>
                      </div>
                      <Downloads run={run} compact />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
