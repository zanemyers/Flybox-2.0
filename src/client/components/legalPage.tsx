import type { ReactNode } from "react";

/** `updated` is an ISO date (YYYY-MM-DD); the displayed form is derived from it. */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    /* max-w-3xl narrows .shell for long-form — at the full 6xl the 68ch measure left 475px of dead space. */
    <article className="shell max-w-3xl py-12">
      <h1>{title}</h1>
      <p className="mt-2 flex items-baseline gap-2">
        <span className="eyebrow">Last updated</span>
        {/* timeZone UTC, or an ISO date renders a day early for anyone west of it. */}
        <time className="readout text-micro text-base-content/70" dateTime={updated}>
          {new Date(updated).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" })}
        </time>
      </p>
      <div className="prose-measure mt-8 space-y-8">{children}</div>
    </article>
  );
}

export function Clause({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section className="border-t border-rule pt-6">
      <h2 className="text-xl">{heading}</h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

export function GithubIssues() {
  return (
    <a className="link link-primary" href="https://github.com/zanemyers/Flybox-2.0/issues">
      GitHub repository
    </a>
  );
}
