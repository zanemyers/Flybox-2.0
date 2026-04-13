"use client";

import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { Suspense } from "react";
import FlyboxDoc from "@/app/docs/tabs/flybox";
import GeminiApiDoc from "@/app/docs/tabs/geminiApi";
import SerpApiDoc from "@/app/docs/tabs/serpApi";

function Tab({
  label,
  defaultChecked,
  children,
}: {
  label: string;
  defaultChecked: boolean;
  children: ReactNode;
}) {
  return (
    <>
      <input
        type="radio"
        name="my_tabs"
        className="tab checked:bg-base-200"
        aria-label={label}
        defaultChecked={defaultChecked}
      />
      <div className="tab-content bg-base-200 border-base-300 shadow-lg p-6 max-h-200 overflow-y-auto">
        {children}
      </div>
    </>
  );
}

function DocTabs() {
  const activeTab = useSearchParams().get("tab") ?? "Flybox";

  return (
    <div className="tabs tabs-lift tabs-md lg:tabs-lg">
      <Tab label="Flybox" defaultChecked={activeTab === "Flybox"}>
        <FlyboxDoc />
      </Tab>
      <Tab label="SerpAPI" defaultChecked={activeTab === "SerpAPI"}>
        <SerpApiDoc />
      </Tab>
      <Tab label="Gemini API" defaultChecked={activeTab === "Gemini API"}>
        <GeminiApiDoc />
      </Tab>
    </div>
  );
}

export default function Docs() {
  return (
    <div className="w-3/4 mx-auto my-8 py-8 rounded-4xl">
      <Suspense>
        <DocTabs />
      </Suspense>
    </div>
  );
}
