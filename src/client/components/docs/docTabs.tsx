"use client";

import { useSearchParams } from "next/navigation";
import type { ComponentType, ReactNode } from "react";
import { GeminiApiDoc, SerpApiDoc } from "@/client/components/docs/apiKeyDocs";
import FlyboxDoc from "@/client/components/docs/flybox";

interface TabDef {
  label: string;
  component: ComponentType;
}

const TABS: TabDef[] = [
  { label: "Flybox", component: FlyboxDoc },
  { label: "SerpAPI", component: SerpApiDoc },
  { label: "Gemini API", component: GeminiApiDoc },
];

function Tab({ label, defaultChecked, children }: { label: string; defaultChecked: boolean; children: ReactNode }) {
  return (
    <>
      <input
        type="radio"
        name="my_tabs"
        className="tab font-mono !text-micro font-medium uppercase tracking-[0.08em]"
        aria-label={label}
        defaultChecked={defaultChecked}
      />
      {/* No max-h/overflow here: a nested scroll region traps the wheel, breaks the
          in-page hash links the Flybox TOC relies on, and hides text from Cmd-F. */}
      <div className="tab-content border-rule bg-base-200 p-5 sm:p-6">{children}</div>
    </>
  );
}

export default function DocTabs() {
  const requested = useSearchParams().get("tab");
  // An unrecognised ?tab= value used to leave every tab unchecked, rendering a blank page.
  const activeTab = TABS.some((t) => t.label === requested) ? requested : TABS[0].label;

  return (
    <div className="tabs tabs-border">
      {TABS.map(({ label, component: Content }) => (
        <Tab key={label} label={label} defaultChecked={activeTab === label}>
          <Content />
        </Tab>
      ))}
    </div>
  );
}
