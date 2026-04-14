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
      <input type="radio" name="my_tabs" className="tab checked:bg-base-200" aria-label={label} defaultChecked={defaultChecked} />
      <div className="tab-content bg-base-200 border-base-300 shadow-lg p-6 max-h-200 overflow-y-auto">{children}</div>
    </>
  );
}

export default function DocTabs() {
  const activeTab = useSearchParams().get("tab") ?? "Flybox";

  return (
    <div className="tabs tabs-lift tabs-md lg:tabs-lg">
      {TABS.map(({ label, component: Content }) => (
        <Tab key={label} label={label} defaultChecked={activeTab === label}>
          <Content />
        </Tab>
      ))}
    </div>
  );
}
