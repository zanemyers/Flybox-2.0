"use client";

import type { ListItems } from "@/client/components/docs";
import { DocSection, ListBlock, sectionId } from "@/client/components/docs";
import { details } from "@/client/images/docs";

/* Section titles live here and are used for BOTH the contents list and the
   DocSection headings, so a TOC entry can no longer point at an id that does not
   exist — three of the five links were dead before. */
const SECTIONS = {
  form: "Using the Flybox Form",
  output: "Output Files",
  disclaimers: "Disclaimers",
  notes: "Additional Notes",
} as const;

const toc: { title: string; children?: string[] }[] = [
  { title: SECTIONS.form, children: [SECTIONS.output] },
  { title: SECTIONS.disclaimers },
  { title: SECTIONS.notes },
];

const input: ListItems[] = [
  {
    label: "SerpAPI Key",
    main: "Enter your private API key to allow Flybox to access Google Maps data.",
    noteLabel: "Note",
    note: "Required for the tool to work.",
  },
  {
    label: "Gemini API Key",
    main: "Enter your private API key to allow Flybox to summarize fishing reports.",
    noteLabel: "Note",
    note: "Required for the tool to work.",
  },
  {
    label: "Search Term",
    main: 'Type of business you want to find (e.g., "Fly Fishing Shops").',
    noteLabel: "Default",
    note: <code>Fly Fishing Shops</code>,
  },
  {
    label: "Position",
    main: "Latitude and longitude for the search. Open the map picker to click a spot, drag the marker, or search for a place by name.",
    noteLabel: "Default",
    note: (
      <span>
        Yellowstone National Park (<strong>Latitude:</strong> <code>44.427963</code>, <strong>Longitude:</strong> <code>-110.588455</code>)
      </span>
    ),
  },
  {
    label: "Rivers",
    main: "Optional. Filters the report phase to shops whose name, website, or address mentions one of these rivers.",
    noteLabel: "Tip",
    note: "Type or paste a comma-separated list — each name becomes its own tag.",
  },
  {
    label: "Summary Prompt",
    main: "The instructions sent to Gemini alongside the crawled text. Edit it to change the shape of the summary.",
  },
];

const output: ListItems[] = [
  {
    label: "report_summary.txt",
    main: "AI-generated summary of fishing reports found across all shop websites.",
  },
  {
    label: "shop_details.xlsx",
    main: "Contains detailed info from shop websites (emails, online stores, social links, fishing reports).",
    img: details,
    alt: "Shop Details",
  },
];

const disclaimers: ListItems[] = [
  {
    label: "Email scraping",
    main: "Some emails may be missing or outdated. Results are not guaranteed to be 100% accurate.",
  },
  {
    label: "Blocked pages",
    main: "Some websites may prevent Flybox from accessing them. Fallback data will be used in these cases.",
  },
  {
    label: "Gemini availability",
    main: "Google Gemini may occasionally be unavailable. Flybox will retry automatically, but if it remains unavailable the raw crawled text will be returned instead of a summary.",
  },
];

const notes: ListItems[] = [
  {
    main: "Future updates may add support for other APIs and extra filtering options to refine searches.",
  },
];

export default function FlyboxDoc() {
  return (
    <>
      <h1>Flybox documentation</h1>
      <p className="prose-measure mt-3">
        Flybox finds fly-fishing shops using <strong>Google Maps</strong> via <strong>SerpAPI</strong>, scrapes their websites for fishing reports, and
        summarizes them with <strong>Google Gemini</strong>.
      </p>

      <nav aria-label="Contents" className="mt-6 border-y border-rule py-4">
        <span className="eyebrow">Contents</span>
        <ul className="ms-4 mt-2 list-disc text-sm">
          {toc.map(({ title, children }) => (
            <li key={title}>
              <a className="link link-accent" href={`#${sectionId(title)}`}>
                {title}
              </a>
              {children && (
                <ul className="ms-4 list-disc">
                  {children.map((child) => (
                    <li key={child}>
                      <a className="link link-accent" href={`#${sectionId(child)}`}>
                        {child}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-8">
        <DocSection
          title={SECTIONS.form}
          overview="Enter your API keys, a search term, and a position. You can also filter by river names and customize the summary prompt."
          conclusion={
            <p>
              Press <strong>Run Flybox</strong>. Progress updates appear on the page and both files download automatically when they are ready.
            </p>
          }
        >
          <ListBlock items={input} />
          <DocSection subSection title={SECTIONS.output} overview="After running, Flybox produces:">
            <ListBlock items={output} />
          </DocSection>
        </DocSection>

        <DocSection title={SECTIONS.disclaimers}>
          <ListBlock items={disclaimers} />
        </DocSection>

        <DocSection title={SECTIONS.notes}>
          <ListBlock items={notes} />
        </DocSection>
      </div>
    </>
  );
}
