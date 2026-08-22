import type { Metadata } from "next";
import Image from "next/image";
import type { ReactNode } from "react";
import { FiAlertTriangle, FiFile, FiFileText } from "react-icons/fi";
import { ContourField } from "@/client/components/brand";
import { details } from "@/client/images/bts";

export const metadata: Metadata = {
  title: "How it works — Flybox",
  description: "What Flybox actually does between pressing run and downloading a report.",
};

interface Stage {
  code: string;
  title: string;
  detail: ReactNode;
  facts: [string, string][];
}

/* Kept honest against src/server/pipeline.ts — if a number changes there, change
   it here. These are the constants a curious user would actually want. */
const stages: Stage[] = [
  {
    code: "01",
    title: "Find the shops",
    detail:
      "Your map position becomes a Google Maps search for fly-fishing shops, run through SerpAPI. Results come back 20 at a time, and Flybox stops asking for pages as soon as one comes back short — a quiet location costs a single search instead of five.",
    facts: [
      ["Provider", "SerpAPI maps"],
      ["Page size", "20 results"],
      ["Max searches", "5 per run"],
    ],
  },
  {
    code: "02",
    title: "Check the rules",
    detail: (
      <>
        Before touching a shop&apos;s site, Flybox reads its <code>robots.txt</code> and honors it — including <code>Allow</code>/<code>Disallow</code>{" "}
        precedence, wildcards and <code>crawl-delay</code>. Sites that say no are skipped and recorded in the log.
      </>
    ),
    facts: [
      ["Respects", "robots.txt"],
      ["Crawl-delay", "capped at 5s"],
    ],
  },
  {
    code: "03",
    title: "Read each shop",
    detail:
      "Each site is fetched over plain HTTP first. If the page turns out to be a JavaScript shell or the request is blocked, Flybox retries it through a stealth headless browser. It then pulls out the email, social profiles, whether the shop sells online, and whether it publishes fishing reports.",
    facts: [
      ["Concurrency", "10 shops at once"],
      ["Fallback", "Playwright"],
      ["Email lookup", "5 strategies"],
    ],
  },
  {
    code: "04",
    title: "Crawl for reports",
    detail:
      "Shops that publish reports get crawled properly: a priority queue walks each site, preferring paths that look like report archives and ignoring PDFs, privacy policies, carts and tracking-tagged duplicates. Only whole pages are kept, so nothing arrives cut off mid-sentence.",
    facts: [
      ["Strategy", "priority queue"],
      ["Concurrency", "3 sites at once"],
      ["Skips", "binaries, legal, dupes"],
    ],
  },
  {
    code: "05",
    title: "Summarize",
    detail: (
      <>
        The collected text is sent to OpenAI once, with instructions to merge duplicate waters, keep the three most recent dates for each, and cite its sources.
        Turn <code>Summarize with AI</code> off and this step is skipped entirely — you get the crawled text instead, and a far larger allowance of it.
      </>
    ),
    facts: [
      ["Model", "gpt-5.6-luna"],
      ["Fallback", "gpt-5.6-terra"],
      ["Calls per run", "1"],
    ],
  },
];

export default function HowItWorks() {
  return (
    <div className="shell py-12">
      <section className="relative overflow-hidden pb-10">
        <div className="pointer-events-none absolute inset-0">
          <ContourField />
        </div>
        <div className="relative">
          <span className="eyebrow">Behind the scenes</span>
          <h1 className="mt-2 max-w-[46ch]">What happens after you press run</h1>
          <p className="prose-measure mt-3">
            Flybox is a five-stage pipeline. You give it a position; it comes back with a report and a spreadsheet. This is everything in between — no setup
            required, but worth a look if you want to know what it is doing on your behalf.
          </p>
        </div>
      </section>

      <ol role="list" className="ms-0 list-none">
        {stages.map(({ code, title, detail, facts }) => (
          <li key={code} className="border-t border-rule py-8 last:border-b">
            <div className="grid gap-6 md:grid-cols-[3rem_minmax(0,1fr)_16rem]">
              <span aria-hidden="true" className="readout text-mark text-sm">
                {code}
              </span>

              <div>
                <h2 className="text-xl">{title}</h2>
                <p className="prose-measure mt-2 text-sm">{detail}</p>
              </div>

              <dl className="well h-fit text-xs">
                {facts.map(([k, v]) => (
                  <div key={k} className="flex items-baseline justify-between gap-3 border-b border-rule py-1.5 last:border-b-0">
                    <dt className="eyebrow shrink-0">{k}</dt>
                    <dd className="readout text-accent text-right text-micro text-nowrap">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </li>
        ))}
      </ol>

      <section className="mt-12">
        <h2 className="eyebrow">The two files</h2>
        <hr className="my-2" />
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <p className="readout flex items-center gap-2 text-sm text-mark">
              <FiFileText className="size-4 shrink-0" />
              report_summary.txt
            </p>
            <p className="mt-2 text-sm text-base-content/70">
              Every fishing report Flybox found, merged by body of water with the three most recent dates for each, fly patterns, colors, hook sizes and
              sources. With summarization off, this is the raw crawled text instead.
            </p>
          </div>
          <div>
            <p className="readout flex items-center gap-2 text-sm text-mark">
              <FiFile className="size-4 shrink-0" />
              shop_details.xlsx
            </p>
            <p className="mt-2 text-sm text-base-content/70">
              One row per shop: name, website, address, phone, rating, review count, category, email, social profiles, and whether it sells online or publishes
              reports.
            </p>
            <div className="mt-3 rounded-field border border-rule bg-base-100 p-2 in-data-[theme=dark]:opacity-75">
              <Image
                src={details}
                alt="The shop directory spreadsheet, one row per shop"
                sizes="(min-width: 1152px) 540px, (min-width: 768px) 45vw, 100vw"
                className="h-auto max-w-full"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="mt-10 border-t border-rule pt-4">
        <p className="flex items-start gap-2 text-xs text-base-content/70">
          <FiAlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          <span>
            <span className="eyebrow me-1.5">Accuracy</span>
            Emails and report detection are best-effort — some sites block crawlers, and summaries are generated by a model. Treat the output as a starting
            point, not a verified directory.
          </span>
        </p>
      </section>
    </div>
  );
}
