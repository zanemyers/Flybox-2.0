import type { Metadata } from "next";
import Link from "next/link";
import { ContourField } from "@/client/components/brand";
import FlyboxForm from "@/client/components/flyboxForm";

export const metadata: Metadata = {
  title: "Home — Flybox",
  description: "Find local fly fishing shops, scrape their fishing reports, and get an AI-powered summary for any location.",
};

const steps = [
  <>
    Pick a <strong>position</strong> on the map — anywhere you want shops found near.
  </>,
  <>
    Optionally filter by <strong>river name</strong> — add as many as you like.
  </>,
  <>
    Choose whether to <strong>summarize with AI</strong> or take the raw crawled text.
  </>,
  <>
    Press <strong>Run Flybox</strong> and sit back while the pipeline runs.
  </>,
  <>
    Whatever you asked for downloads automatically when it is ready — the <strong>report</strong>, and the <strong>shop directory</strong> if you kept it.
  </>,
];

export default function Home() {
  return (
    <div className="shell">
      <section className="relative overflow-hidden py-14 sm:py-16">
        <div className="pointer-events-none absolute inset-0">
          <ContourField />
        </div>
        <div className="relative">
          <span className="eyebrow">SerpAPI · Playwright · GPT-5.6</span>
          <h1 className="mt-2">Field report generator</h1>
          <p className="prose-measure mt-3">
            Get a fly-fishing <strong>report summary</strong> and <strong>shop directory</strong> for any location — automatically. Pick a spot on the map and
            press run. No API keys, no setup.
          </p>
        </div>
      </section>

      {/* DOM order is visual order at every width — no `order` utilities. Reversing them at lg made keyboard focus jump up-and-left after the last field. */}
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,6fr)_minmax(0,4fr)]">
        <div className="min-w-0">
          <FlyboxForm />
        </div>

        <div className="flex min-w-0 flex-col gap-8 lg:sticky lg:top-20 lg:self-start">
          <section>
            <h2 className="eyebrow">How it runs</h2>
            <hr className="my-2" />
            {/* The numerals are decorative — the list already numbers itself. */}
            <ol className="ms-0 grid list-none grid-cols-[2.5rem_1fr] divide-y divide-rule" role="list">
              {steps.map((step, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: ordered steps, index IS the identity
                <li key={i} className="col-span-2 grid grid-cols-subgrid items-baseline py-2">
                  <span aria-hidden="true" className="readout text-micro text-mark">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="text-sm">{step}</span>
                </li>
              ))}
            </ol>
            <p className="mt-3 text-xs text-base-content/70">
              Curious what happens after you press run? See{" "}
              <Link className="link link-primary" href="/how-it-works">
                how it works
              </Link>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
