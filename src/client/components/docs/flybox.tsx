"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { ListItems, TocItem } from "@/client/components/docs";
import { DocSection, ListBlock } from "@/client/components/docs";
import { details, simpleDetails } from "@/client/images/docs";

const toc: TocItem[] = [
  {
    label: "Using the Form",
    children: [{ label: "Input" }, { label: "Output" }],
  },
  { label: "Disclaimers" },
  { label: "Additional Notes" },
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
    label: "Location",
    main: "Latitude and longitude for the search. You can also click the map to pick a spot.",
    noteLabel: "Default",
    note: (
      <p>
        Yellowstone National Park (<strong>Latitude:</strong> <code>44.427963</code>, <strong>Longitude:</strong>{" "}
        <code>-110.588455</code>)
      </p>
    ),
  },
];

const output: ListItems[] = [
  {
    label: "simple_shop_details.xlsx",
    main: "Created immediately. Contains basic shop info and can be reused.",
    img: simpleDetails,
    alt: "Simple Shop Details",
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
];

const notes: ListItems[] = [
  {
    main: "Future updates may add support for other APIs and extra filtering options to refine searches.",
  },
];

const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

function TocLink({ label, children }: { label: string; children?: ReactNode }) {
  const target = label.toLowerCase().replace(/\s+/g, "-");
  return (
    <li className="underline text-primary hover:text-secondary">
      <Link className="link-hash" href={`#${target}`} onClick={(e) => { e.preventDefault(); scrollTo(target); }}>
        {label}
      </Link>
      {children}
    </li>
  );
}

export default function FlyboxDoc() {
  return (
    <>
      <h1 className="text-4xl font-semibold pb-3">🎣 Flybox Documentation</h1>
      <p>
        Flybox finds fly-fishing shops using <strong>Google Maps</strong> via <strong>SerpAPI</strong>, scrapes their
        websites for fishing reports, and summarizes them with <strong>Google Gemini</strong>.
      </p>
      <hr />
      <div>
        <h3>Contents</h3>
        <ul>
          {toc.map((item) => (
            <TocLink key={item.label} label={item.label}>
              {item.children && (
                <ul>
                  {item.children.map((child) => (
                    <TocLink key={child.label} label={child.label} />
                  ))}
                </ul>
              )}
            </TocLink>
          ))}
        </ul>
      </div>

      <hr />

      <DocSection
        title="Using the Flybox Form"
        overview="Enter your API keys, a search term, and a location. Advanced settings let you filter by rivers, adjust report age, and customize the summary prompt."
        conclusion={
          <p>
            Click <strong>Run Flybox</strong>. Progress updates will appear on the page and files will automatically
            download when done.
          </p>
        }
      >
        <ListBlock items={input} />
        <DocSection subSection={true} title="Output Files" overview="After running, Flybox produces:">
          <ListBlock items={output} />
        </DocSection>
      </DocSection>

      <hr />

      <DocSection title="Disclaimers">
        <ListBlock items={disclaimers} />
      </DocSection>

      <hr />

      <DocSection title="Additional Notes">
        <ListBlock items={notes} />
      </DocSection>
    </>
  );
}
