import type React from "react";

/** Shared skeleton for the privacy policy and terms pages, which were previously
    two copies of the same wrapper. Clause heads are <h2> under the page's one <h1>. */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <article className="shell prose-measure py-12">
      <h1>{title}</h1>
      <p className="eyebrow mt-2">Last updated · {updated}</p>
      <div className="mt-8">{children}</div>
    </article>
  );
}

export function Clause({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section className="mt-8 border-t border-rule pt-6 first:mt-0 first:border-t-0 first:pt-0">
      <h2 className="text-xl">{heading}</h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

export function GithubIssues() {
  return (
    <a className="link link-accent" href="https://github.com/zanemyers/Flybox-2.0/issues" target="_blank" rel="noopener noreferrer">
      GitHub repository
    </a>
  );
}
