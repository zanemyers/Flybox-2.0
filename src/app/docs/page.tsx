import type { Metadata } from "next";
import { Suspense } from "react";
import DocTabs from "@/client/components/docs/docTabs";

export const metadata: Metadata = {
  title: "Docs — Flybox",
  description: "Documentation for Flybox, including setup guides for SerpAPI and Google Gemini.",
};

export default function Docs() {
  return (
    <div className="shell py-10">
      <Suspense
        fallback={
          <div className="py-16">
            <div className="run-bar mx-auto w-40" />
            <span className="sr-only">Loading documentation</span>
          </div>
        }
      >
        <DocTabs />
      </Suspense>
    </div>
  );
}
