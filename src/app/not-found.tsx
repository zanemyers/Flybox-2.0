import type { Metadata } from "next";
import Link from "next/link";
import { ContourField } from "@/client/components/brand";

export const metadata: Metadata = {
  title: "Page not found — Flybox",
  description: "That page does not exist.",
};

/* A sounder with nothing under it. Dashes rather than zeroes: a depth of 0.0 would be a reading,
   and the point is that there is no reading. Reuses the readout well from /how-it-works, so this
   page adds no primitive of its own and brand.tsx stays at two drawings. */
const sounder: [string, string][] = [
  ["Status", "404"],
  ["Route", "not found"],
  ["Position", "--.------, ---.------"],
  ["Depth", "--.- ft"],
];

export default function NotFound() {
  return (
    <div className="shell relative overflow-hidden py-16">
      <div className="pointer-events-none absolute inset-0">
        <ContourField />
      </div>

      <div className="relative grid items-center gap-10 md:grid-cols-2">
        <div className="max-w-[46ch]">
          <span className="eyebrow">Error 404 · Page not found</span>
          <h1 className="mt-2">Gone fishing</h1>
          <p className="mt-4">Looks like the page you were trying to find has drifted downstream.</p>
          <Link href="/" className="btn btn-primary mt-6 h-10">
            Cast a line back home
          </Link>
        </div>

        {/* aria-hidden: the eyebrow and heading already say 404 and not-found, so a screen reader
            would only get a list of dashes out of this. On the wrapper, not the <dl>, so the
            attribute sits on an element that is unambiguously not focusable. */}
        <div aria-hidden="true" className="w-full md:max-w-sm md:justify-self-end">
          <dl className="well select-none text-xs">
            {sounder.map(([label, value]) => (
              <div key={label} className="flex items-baseline justify-between gap-3 border-b border-rule py-1.5 last:border-b-0">
                <dt className="eyebrow shrink-0">{label}</dt>
                <dd className="readout text-nowrap text-right text-micro text-accent">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  );
}
