import type { Metadata } from "next";
import Link from "next/link";
import { FiAlertTriangle, FiLock } from "react-icons/fi";
import { ContourField } from "@/client/components/brand";
import FlyboxForm from "@/client/components/flyboxForm";

export const metadata: Metadata = {
  title: "Flybox — Fly Fishing Report Tool",
  description: "Find local fly fishing shops, scrape their fishing reports, and get an AI-powered summary for any location.",
};

const steps = [
  <>
    Enter your <strong>SerpAPI</strong> and <strong>Gemini API</strong> keys — don&apos;t have them? See the{" "}
    <Link className="link link-accent" href="/docs">
      docs
    </Link>
    .
  </>,
  <>
    Enter a <strong>search term</strong> and pick a <strong>position</strong> on the map.
  </>,
  <>
    Optionally filter results by <strong>river name</strong> — add as many as you like.
  </>,
  <>
    Press <strong>Run Flybox</strong> and sit back while the pipeline runs.
  </>,
  <>
    Your <strong>report summary</strong> and <strong>shop directory</strong> download automatically when ready.
  </>,
];

const notes = [
  {
    Icon: FiAlertTriangle,
    label: "Cost",
    text: "Heavy usage may incur charges — use your own API keys to stay in control of your limits.",
  },
  {
    Icon: FiLock,
    label: "Privacy",
    text: "Your API keys are never stored. Output files are retained temporarily to facilitate downloads.",
  },
];

export default function Home() {
  return (
    <div className="shell">
      <section className="relative overflow-hidden py-14 sm:py-16">
        <div className="pointer-events-none absolute inset-0">
          <ContourField />
        </div>
        <div className="relative">
          <span className="eyebrow">SerpAPI · Playwright · Gemini 2.5</span>
          <h1 className="mt-2">Field report generator</h1>
          <p className="mt-3 max-w-[62ch] [text-wrap:pretty]">
            Get a fly-fishing <strong>report summary</strong> and <strong>shop directory</strong> for any location — automatically. Flybox finds local shops,
            identifies which ones publish fishing reports, and summarizes them with Google Gemini.
          </p>
        </div>
      </section>

      {/* The form comes first in DOM order so a phone gets the tool, not the essay;
          lg puts the explainer back on the left. */}
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,4fr)_minmax(0,6fr)]">
        <div className="lg:order-2">
          <FlyboxForm />
        </div>

        <div className="flex flex-col gap-8 lg:sticky lg:top-20 lg:order-1 lg:self-start">
          <section>
            <span className="eyebrow">What it does</span>
            <hr className="my-2" />
            <p className="prose-measure text-sm">
              Flybox searches Google Maps for shops near a position you choose, crawls each site for contact details and fishing reports, then summarizes the
              reports it finds into one structured document.
            </p>
          </section>

          <section>
            <span className="eyebrow">How it runs</span>
            <hr className="my-2" />
            <ol className="ms-0 grid list-none grid-cols-[2.5rem_1fr] divide-y divide-rule">
              {steps.map((step, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: ordered steps, index IS the identity
                <li key={i} className="col-span-2 grid grid-cols-subgrid items-baseline py-2">
                  <span className="readout text-micro text-primary">{String(i + 1).padStart(2, "0")}</span>
                  <span className="text-sm">{step}</span>
                </li>
              ))}
            </ol>
            <p className="mt-3 text-xs text-base-content/70">
              For more detail, see the{" "}
              <Link className="link link-accent" href="/docs?tab=Flybox">
                Flybox documentation
              </Link>
              .
            </p>
          </section>
        </div>
      </div>

      <div className="mt-10 grid gap-2 border-t border-rule pt-4 pb-12 text-xs text-base-content/70 sm:grid-cols-2">
        {notes.map(({ Icon, label, text }) => (
          <p key={label} className="flex items-start gap-2">
            <Icon className="mt-0.5 size-3.5 shrink-0" />
            <span>
              <span className="eyebrow me-1.5">{label}</span>
              {text}
            </span>
          </p>
        ))}
      </div>
    </div>
  );
}
