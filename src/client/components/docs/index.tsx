"use client";

import type { StaticImageData } from "next/image";
import Image from "next/image";
import type React from "react";

export interface TocItem {
  label: string;
  children?: TocItem[];
}

export interface DocSectionProps {
  subSection?: boolean;
  title: string;
  overview?: string;
  conclusion?: string | React.ReactNode;
  children: React.ReactNode;
}

export interface ListItems {
  label?: string;
  main?: string | React.ReactNode;
  noteLabel?: string;
  note?: string | React.ReactNode;
  img?: string | StaticImageData;
  alt?: string;
  children?: ListItems[];
}

export interface ListBlockProps {
  items: ListItems[];
  ordered?: boolean;
  orderChild?: boolean;
  extraClass?: string;
}

/** Derives the anchor id a TOC entry links to. Exported so the TOC and the
    section headings cannot drift apart. */
export const sectionId = (title: string) => title.toLowerCase().replaceAll(" ", "-");

export function DocSection({ title, subSection, overview, children, conclusion }: DocSectionProps) {
  const id = sectionId(title);
  // h1 (doc title) -> h2 (section) -> h3 (sub-section): no skipped levels.
  const HeaderTag = subSection ? "h3" : "h2";

  return (
    <section id={id} className="group pb-8 last:pb-0">
      <HeaderTag className={subSection ? "" : "border-b border-rule pb-2"}>
        {title}
        <a
          href={`#${id}`}
          className="ms-2 text-primary opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
          aria-label={`Link to ${title}`}
        >
          #
        </a>
      </HeaderTag>
      {overview && <div className={`prose-measure ${subSection ? "pt-1 pb-1" : "pt-3 pb-4"}`}>{overview}</div>}
      {children}
      {conclusion && <div className="prose-measure pt-3">{conclusion}</div>}
    </section>
  );
}

export function ListBlock({ ordered, orderChild, extraClass, items }: ListBlockProps) {
  const ListTag = ordered ? "ol" : "ul";

  return (
    <ListTag className={`prose-measure space-y-2 ${ordered ? "[&>li]:marker:font-mono [&>li]:marker:text-mark" : ""} ${extraClass ?? ""}`}>
      {items.map((item, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: list items have no natural unique key
        <li key={`item-${index}`}>
          <div className="flex flex-row flex-wrap">
            {item.label && (
              <strong className={item.main ? "mr-1" : ""}>
                {item.label}
                {item.main && ":"}
              </strong>
            )}
            {item.main}
          </div>

          {item.note && (
            <div className="flex flex-row flex-wrap text-sm text-base-content/70">
              {item.noteLabel && <em className="mr-1.5">{item.noteLabel}:</em>}
              {item.note}
            </div>
          )}

          {item.children && <ListBlock items={item.children} ordered={orderChild} />}

          {item.img && item.alt && (
            <div className="mt-3 rounded-field border border-rule bg-base-100 p-2">
              <Image src={item.img} alt={item.alt} className="h-auto max-w-full" />
            </div>
          )}
        </li>
      ))}
    </ListTag>
  );
}
