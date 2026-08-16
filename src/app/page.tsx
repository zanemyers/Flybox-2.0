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
    Your <strong>report</strong> and <strong>shop directory</strong> download automatically when ready.
  </>,
];

const outputs = [
  {
    name: "report_summary.txt",
    text: "Fishing reports from every shop that publishes them, grouped by body of water — or the raw crawled text if you turn summarization off.",
  },
  { name: "shop_details.xlsx", text: "Every shop found: name, website, address, phone, rating, email, socials, and whether it sells online or posts reports." },
];

const notes = [
  {
    Icon: FiAlertTriangle,
    label: "Limits",
    text: "Flybox supplies its own API keys, so runs are rate limited to keep the service available to everyone.",
  },
  {
    Icon: FiLock,
    label: "Privacy",
    text: "No account, no keys, nothing personal stored. Output files are retained only long enough to download them.",
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
          <span className="eyebrow">SerpAPI · Playwright · GPT-5.6</span>
          <h1 className="mt-2">Field report generator</h1>
          <p className="prose-measure mt-3">
            Get a fly-fishing <strong>report summary</strong> and <strong>shop directory</strong> for any location — automatically. Pick a spot on the map and
            press run. No API keys, no setup.
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
            <span className="eyebrow">How it runs</span>
            <hr className="my-2" />
            <ol className="ms-0 grid list-none grid-cols-[2.5rem_1fr] divide-y divide-rule">
              {steps.map((step, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: ordered steps, index IS the identity
                <li key={i} className="col-span-2 grid grid-cols-subgrid items-baseline py-2">
                  <span className="readout text-micro text-mark">{String(i + 1).padStart(2, "0")}</span>
                  <span className="text-sm">{step}</span>
                </li>
              ))}
            </ol>
            <p className="mt-3 text-xs text-base-content/70">
              Curious what runs under the hood? See{" "}
              <Link className="link link-primary" href="/how-it-works">
                how it works
              </Link>
              .
            </p>
          </section>

          <section>
            <span className="eyebrow">What you get</span>
            <hr className="my-2" />
            <ul className="ms-0 list-none divide-y divide-rule">
              {outputs.map(({ name, text }) => (
                <li key={name} className="py-2">
                  <span className="readout block text-xs text-mark">{name}</span>
                  <span className="mt-0.5 block text-sm text-base-content/70">{text}</span>
                </li>
              ))}
            </ul>
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
