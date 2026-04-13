"use client";

import Link from "next/link";
import { DocSection, ListBlock } from "@/client/components/docs";
import { details, simpleDetails } from "@/client/images/docs";
import type { ListItems, TocItem } from "@/server/types/componentTypes";

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
        Yellowstone National Park (<strong>Latitude:</strong>{" "}
        <code>44.427963</code>, <strong>Longitude:</strong>{" "}
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

export default function FlyboxDoc() {
  return (
    <>
      <h1 className="text-4xl font-semibold pb-3">🎣 Flybox Documentation</h1>
      <p>
        Flybox finds fly-fishing shops using <strong>Google Maps</strong> via{" "}
        <strong>SerpAPI</strong>, scrapes their websites for fishing reports,
        and summarizes them with <strong>Google Gemini</strong>.
      </p>
      <hr />
      <div>
        <h3>Contents</h3>
        <ul>
          {toc.map((item) => {
            const target = item.label.toLowerCase().replace(/\s+/g, "-");
            return (
              <li
                key={target}
                className="underline text-primary hover:text-secondary"
              >
                <Link
                  className="link-hash"
                  href={`#${target}`}
                  onClick={(e) => {
                    e.preventDefault();
                    document
                      .getElementById(target)
                      ?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                >
                  {item.label}
                </Link>
                {item.children && (
                  <ul>
                    {item.children.map((child) => {
                      const childTarget = child.label
                        .toLowerCase()
                        .replace(/\s+/g, "-");
                      return (
                        <li
                          key={childTarget}
                          className="underline text-primary hover:text-secondary"
                        >
                          <Link
                            className="link-hash"
                            href={`#${childTarget}`}
                            onClick={(e) => {
                              e.preventDefault();
                              document
                                .getElementById(childTarget)
                                ?.scrollIntoView({
                                  behavior: "smooth",
                                  block: "start",
                                });
                            }}
                          >
                            {child.label}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <hr />

      <DocSection
        title="Using the Flybox Form"
        overview="Enter your API keys, a search term, and a location. Advanced settings let you filter by rivers, adjust report age, and customize the summary prompt."
        conclusion={
          <p>
            Click <strong>Run Flybox</strong>. Progress updates will appear on
            the page and files will automatically download when done.
          </p>
        }
      >
        <ListBlock items={input} />

        <DocSection
          subSection={true}
          title="Output Files"
          overview="After running, Flybox produces:"
        >
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
