import type { Metadata } from "next";
import { Suspense } from "react";
import DocTabs from "@/client/components/docs/docTabs";

export const metadata: Metadata = {
  title: "Docs — Flybox",
  description: "Documentation for Flybox, including setup guides for SerpAPI and Google Gemini.",
};

export default function Docs() {
  return (
    <div className="w-3/4 mx-auto my-8 py-8 rounded-4xl">
      <Suspense fallback={<div className="flex justify-center py-16"><span className="loading loading-spinner loading-lg" /></div>}>
        <DocTabs />
      </Suspense>
    </div>
  );
}
