"use client";

import Image from "next/image";
import type {
  DocSectionProps,
  ListBlockProps,
} from "@/server/types/componentTypes";

export function DocSection({
  title,
  subSection,
  overview,
  children,
  conclusion,
}: DocSectionProps) {
  const id = title.toLowerCase().replaceAll(" ", "-");
  const HeaderTag = subSection ? "h5" : "h3";

  return (
    <section id={id} className="pb-6">
      <HeaderTag className={subSection ? "" : "py-2"}>{title}</HeaderTag>
      {overview && (
        <div className={subSection ? "pb-1" : "pb-6"}>{overview}</div>
      )}
      {children}
      {conclusion}
    </section>
  );
}

export function ListBlock({
  ordered,
  orderChild,
  extraClass,
  items,
}: ListBlockProps) {
  const ListTag = ordered ? "ol" : "ul";

  return (
    <ListTag className={extraClass}>
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
            <div className="flex flex-row flex-wrap">
              {item.noteLabel && <em className="mr-1.5">{item.noteLabel}:</em>}
              {item.note}
            </div>
          )}

          {item.children && (
            <ListBlock items={item.children} ordered={orderChild} />
          )}

          {item.img && item.alt && (
            <div className="flex justify-center pb-4">
              <Image src={item.img} alt={item.alt} />
            </div>
          )}
        </li>
      ))}
    </ListTag>
  );
}
