"use client";

import Link from "next/link";
import { useEffect } from "react";
import { ContourField } from "@/client/components/brand";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  // Set imperatively because a client component cannot export metadata, so the
  // tab would otherwise keep the title of whichever page just failed.
  useEffect(() => {
    document.title = "Something went wrong — Flybox";
  }, []);

  return (
    <div className="shell relative overflow-hidden py-16">
      <div className="pointer-events-none absolute inset-0">
        <ContourField />
      </div>

      {/* Left-aligned like every other page. The watermark is a sibling column
          rather than an absolute overlay, so it can never sit behind the copy. */}
      <div className="relative grid items-center gap-10 md:grid-cols-[minmax(0,46ch)_1fr]">
        <div>
          <span className="eyebrow">Error 500 · Unexpected error</span>
          <h1 className="mt-2">Instrument fault</h1>
          <p className="mt-4">An unexpected error occurred. Try refreshing the page or heading back home.</p>

          {/* The digest was previously console-only, so a user had nothing to quote in a bug report. */}
          <div className="well mt-5 flex items-center gap-3">
            <span className="eyebrow">Digest</span>
            <code className="readout select-all text-xs">{error.digest ?? "—"}</code>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <button type="button" className="btn btn-primary h-10" onClick={reset}>
              Try again
            </button>
            <Link href="/" className="btn btn-ghost h-10 border border-stroke">
              Back to home
            </Link>
          </div>
        </div>

        <span aria-hidden="true" className="readout hidden select-none justify-self-end text-[7rem] leading-none text-base-content/10 md:block">
          500
        </span>
      </div>
    </div>
  );
}
