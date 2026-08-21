"use client";

import { useEffect, useRef, useState } from "react";
import { FiDownload, FiFile, FiFileText, FiSquare, FiWifiOff } from "react-icons/fi";

type Status = "IN_PROGRESS" | "COMPLETED" | "CANCELED" | "FAILED";

interface JobUpdate {
  message: string;
  status: Status;
  createdAt: string;
  files: { name: string }[];
}

const MAX_FAILURES = 5;

/** Fixed names produced by the pipeline — rendered up front so the user knows
    two outputs are coming before either exists. */
const EXPECTED_OUTPUTS = [
  { name: "report_summary.txt", type: "TXT", Icon: FiFileText },
  { name: "shop_details.xlsx", type: "XLSX", Icon: FiFile },
] as const;

const fileUrl = (jobId: string, name: string) => `/api/flybox/${jobId}/files/${name}`;

function elapsed(from: number, to: number): string {
  const total = Math.max(0, Math.floor((to - from) / 1000));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `T+${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
}

export default function StatusPanel({ jobId, onClose }: { jobId: string; onClose: () => void }) {
  const [status, setStatus] = useState<Status>("IN_PROGRESS");
  const [ready, setReady] = useState<Set<string>>(new Set());
  const [pollError, setPollError] = useState<string | null>(null);
  const [polling, setPolling] = useState(true);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const progressAreaRef = useRef<HTMLPreElement>(null);
  const downloadedRef = useRef<Set<string>>(new Set());
  const failureCountRef = useRef(0);

  useEffect(() => {
    // `stopped` guards against an in-flight response landing after the interval
    // was cleared, which could regress a finished job back to "Running".
    let stopped = false;

    const stop = () => {
      stopped = true;
      clearInterval(intervalId);
      setPolling(false);
    };

    const intervalId = setInterval(async () => {
      try {
        const res = await fetch(`/api/flybox/${jobId}/updates`);
        if (res.status === 404) {
          if (stopped) return;
          stop();
          setPollError("This job no longer exists — it may have been cleaned up. Close the panel to start a new run.");
          return;
        }
        if (!res.ok) throw new Error(`Server returned ${res.status}`);
        const data = (await res.json()) as JobUpdate;
        if (stopped) return;

        failureCountRef.current = 0;
        setPollError(null);
        if (progressAreaRef.current) {
          progressAreaRef.current.textContent = data.message;
          progressAreaRef.current.scrollTop = progressAreaRef.current.scrollHeight;
        }
        setStatus(data.status);
        setStartedAt(new Date(data.createdAt).getTime());
        setReady(new Set(data.files.map((f) => f.name)));

        // Auto-download each output once, the first poll that reports it ready.
        for (const { name } of data.files) {
          if (downloadedRef.current.has(name)) continue;
          downloadedRef.current.add(name);
          const a = document.createElement("a");
          a.href = fileUrl(jobId, name);
          a.download = name;
          a.click();
        }

        if (data.status !== "IN_PROGRESS") stop();
      } catch {
        if (stopped) return;
        failureCountRef.current += 1;
        if (failureCountRef.current >= MAX_FAILURES) {
          stop();
          setPollError("Lost connection to the server. The job may still be running.");
        } else {
          setPollError(`Connection issue — retrying… (${failureCountRef.current}/${MAX_FAILURES})`);
        }
      }
    }, 2000);

    return () => {
      stopped = true;
      clearInterval(intervalId);
    };
  }, [jobId]);

  const isRunning = status === "IN_PROGRESS";

  // Elapsed clock ticks off the server's createdAt, so it survives a reload.
  useEffect(() => {
    if (!isRunning || startedAt === null) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isRunning, startedAt]);

  const handleCancel = async () => {
    if (!window.confirm("Cancel this job? This cannot be undone.")) return;
    await fetch(`/api/flybox/${jobId}/cancel`, { method: "POST" });
  };

  const isFailed = status === "FAILED" || status === "CANCELED";
  const title = isRunning ? "Running search…" : isFailed ? "Job failed" : "Job complete";

  const chipClass = isRunning ? "border-info text-info" : isFailed ? "border-error text-error" : "border-success text-success";
  const spineClass = isRunning ? "border-l-primary" : isFailed ? "border-l-error" : "border-l-success";

  // A dead job (404) or exhausted retries must not leave "Cancel" as the only action.
  const canCancel = isRunning && polling;

  return (
    <div className={`panel border-l-2 ${spineClass}`}>
      <div className="panel-head">
        <div className="flex min-w-0 items-center gap-3">
          <h2 className="eyebrow">Progress</h2>
          <span className="readout text-micro max-w-[12ch] truncate text-base-content/70" title={jobId}>
            {jobId}
          </span>
        </div>
        <span className={`chip ${chipClass}`}>
          <span className="size-[5px] rounded-full bg-current" />
          {status.replace("_", " ")}
        </span>
      </div>

      {isRunning && <div className="run-bar" />}

      <div className="panel-body flex flex-col gap-3">
        {/* Announced once per state change. The log itself is not a live region —
            it rewrites in full every 2s and would flood a screen reader. */}
        <p className="sr-only" aria-live="polite">
          {title}
        </p>

        <div className="flex items-center justify-between gap-3">
          <span className="text-sm">{title}</span>
          {/* Only while running: the job has no finishedAt, so a clock on a terminal
              job would report time-since-start rather than how long it took. */}
          {isRunning && startedAt !== null && <span className="readout text-micro text-base-content/70">{elapsed(startedAt, now)}</span>}
        </div>

        {/* biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be keyboard-focusable (WCAG 2.1.1); it has role=log and an accessible name */}
        <pre ref={progressAreaRef} className="console" role="log" aria-live="off" tabIndex={0} aria-label="Job progress log" />

        {pollError && (
          <div className="flex items-start gap-2 border-t border-rule pt-3 text-xs">
            <FiWifiOff className="mt-px size-3.5 shrink-0 text-warning" />
            <span>{pollError}</span>
          </div>
        )}

        <div className="border-t border-rule pt-3">
          <span className="eyebrow mb-1 block">Output</span>
          {/* biome-ignore lint/a11y/noRedundantRoles: not redundant here — WebKit drops list semantics when list-style is none, and role="list" restores them */}
          <ul role="list" className="ms-0 list-none divide-y divide-rule">
            {EXPECTED_OUTPUTS.map(({ name, type, Icon }) => {
              const available = ready.has(name);
              return (
                <li key={name} className={`flex min-h-12 items-center gap-3 ${available ? "" : "text-base-content/70"}`}>
                  <Icon className="size-3.5 shrink-0" />
                  <span className="flex-1 truncate font-mono text-xs text-mark">{name}</span>
                  <span className="chip border-rule text-base-content/70">{available ? type : isRunning ? "Pending" : "None"}</span>
                  {available ? (
                    <a href={fileUrl(jobId, name)} download={name} className="icon-btn" aria-label={`Download ${name}`}>
                      <FiDownload className="size-4" />
                    </a>
                  ) : (
                    <span className="size-8 shrink-0" aria-hidden="true" />
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        <button
          type="button"
          className={`btn h-10 w-full gap-2 ${canCancel ? "btn-outline btn-error" : "btn-ghost border border-stroke"}`}
          onClick={canCancel ? handleCancel : onClose}
        >
          {canCancel ? (
            <>
              <FiSquare className="size-3.5" />
              Cancel job
            </>
          ) : (
            "Close"
          )}
        </button>
      </div>
    </div>
  );
}
