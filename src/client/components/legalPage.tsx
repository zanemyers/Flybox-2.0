import type React from "react";

/** Shared skeleton for the privacy policy and terms pages, which were previously
    two copies of the same wrapper. Clause heads are <h2> under the page's one <h1>. */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <article className="shell py-12">
      <h1>{title}</h1>
      <p className="eyebrow mt-2">Last updated · {updated}</p>
      <div className="prose-measure mt-8 space-y-8">{children}</div>
    </article>
  );
}

export function Clause({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-rule pt-6">
      <h2 className="text-xl">{heading}</h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

export function GithubIssues() {
  return (
    <a className="link link-primary" href="https://github.com/zanemyers/Flybox-2.0/issues" target="_blank" rel="noopener noreferrer">
      GitHub repository
    </a>
  );
}
