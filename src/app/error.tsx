"use client";

import Link from "next/link";
import { useEffect } from "react";
import { ContourField } from "@/client/components/brand";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="shell relative grid min-h-[70vh] place-content-center overflow-hidden py-12">
      <div className="pointer-events-none absolute inset-0">
        <ContourField />
      </div>
      {/* Right-aligned so it never sits behind the left-aligned copy, and hidden
          on narrow screens where there is no clear space for it. */}
      <span
        aria-hidden="true"
        className="readout pointer-events-none absolute inset-y-0 right-0 hidden select-none items-center pe-2 text-[7rem] leading-none text-base-content/10 sm:flex"
      >
        500
      </span>

      <div className="relative max-w-[46ch]">
        <span className="eyebrow">Unexpected error</span>
        <h1 className="mt-2">Instrument fault</h1>
        <p className="mt-4">An unexpected error occurred. Try refreshing the page or heading back home.</p>

        {/* The digest was previously console-only, so a user had nothing to quote in a bug report. */}
        <div className="well mt-5 flex items-center gap-3">
          <span className="eyebrow">Digest</span>
          <code className="readout select-all text-xs">{error.digest ?? "—"}</code>
        </div>

        <div className="mt-6 flex gap-2">
          <button type="button" className="btn btn-primary h-10" onClick={reset}>
            Try again
          </button>
          <Link href="/" className="btn btn-ghost h-10 border border-rule">
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
