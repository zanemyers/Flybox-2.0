"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import TagInput from "@/client/components/inputs/tagInput";
import TextareaInput from "@/client/components/inputs/textareaInput";
import TextInput from "@/client/components/inputs/textInput";
import StatusPanel from "@/client/components/statusPanel";
import { useForm } from "@/client/hooks/useForm";

const MapInput = dynamic(() => import("@/client/components/inputs/mapInput"), {
  ssr: false,
});

const DEFAULT_SUMMARY_PROMPT = `
You are summarizing fly fishing reports. For each body of water, produce one entry using the template below.

Rules:
1. One entry per unique body of water — merge duplicates, keeping the 3 most recent dates.
2. Most recent date first.
3. If a date appears in the text but not a date field, move it to Date.
4. If an article covers multiple bodies of water, create a separate entry for each.
5. List all applicable water types next to the name (river, lake, reservoir, creek, fork, etc.).
6. Omit any bullet point for which no information is available.
7. List all sources used at the end of each entry.

# 1. Madison River (river)
  * Date: June 19, 2025
    * Fly Patterns: ...
    * Colors: ...
    * Hook Sizes: ...
  * Date: June 13, 2025
    * Fly Patterns: ...
    * Colors: ...
    * Hook Sizes: ...
  * Sources: www.example.com
`.trim();

interface FormState {
  serpApiKey: string;
  geminiApiKey: string;
  searchTerm: string;
  latitude: number;
  longitude: number;
  rivers: string[];
  summaryPrompt: string;
}

export default function FlyboxForm({
  defaultSerpApiKey = "",
  defaultGeminiApiKey = "",
}: {
  defaultSerpApiKey?: string;
  defaultGeminiApiKey?: string;
}) {
  const { jobId, submit, reset } = useForm("flybox");

  const [form, setForm] = useState<FormState>({
    serpApiKey: defaultSerpApiKey,
    geminiApiKey: defaultGeminiApiKey,
    searchTerm: "Fly Fishing Shops",
    latitude: 44.427963,
    longitude: -110.588455,
    rivers: [],
    summaryPrompt: DEFAULT_SUMMARY_PROMPT,
  });

  const [submitting, setSubmitting] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("flybox-form");
    if (!saved) return;
    const parsed = JSON.parse(saved) as Partial<FormState>;
    setForm((prev) => ({ ...prev, ...parsed }));
  }, []);

  useEffect(() => {
    const { serpApiKey, geminiApiKey, ...rest } = form;
    localStorage.setItem("flybox-form", JSON.stringify(rest));
  }, [form]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const resetForm = () => {
    if (!confirmReset) {
      setConfirmReset(true);
      return;
    }
    setConfirmReset(false);
    localStorage.removeItem("flybox-form");
    setForm((prev) => ({
      serpApiKey: prev.serpApiKey,
      geminiApiKey: prev.geminiApiKey,
      searchTerm: "Fly Fishing Shops",
      latitude: 44.427963,
      longitude: -110.588455,
      rivers: [],
      summaryPrompt: DEFAULT_SUMMARY_PROMPT,
    }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await submit(form as unknown as FormState);
    } catch {
      console.error("Submission failed.");
      setSubmitting(false);
    }
  };

  if (jobId) {
    return <StatusPanel route="flybox" jobId={jobId} onClose={() => { reset(); setSubmitting(false); }} />;
  }

  return (
    <div className="app-panel flex flex-col">
      <form
        id="flybox-form"
        noValidate
        className="card bg-base-200 border border-base-300 shadow-sm"
        onSubmit={(e) => {
          e.preventDefault();
          if (e.currentTarget.checkValidity()) handleSubmit();
          else e.currentTarget.reportValidity();
        }}
      >
        <div className="card-body">
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-2 gap-y-4 sm:gap-y-0">
              <TextInput
                type="password"
                label="SerpAPI Key"
                placeholder="Enter your SerpAPI key"
                value={form.serpApiKey}
                onChange={(v) => update("serpApiKey", v)}
              />
              <TextInput
                type="password"
                label="Gemini API Key"
                placeholder="Enter your Gemini API key"
                value={form.geminiApiKey}
                onChange={(v) => update("geminiApiKey", v)}
              />
            </div>
            <TextInput
              label="Search Term"
              placeholder="e.g. Fly Fishing Shops"
              value={form.searchTerm}
              onChange={(v) => update("searchTerm", v)}
            />
            <MapInput
              latitude={form.latitude}
              longitude={form.longitude}
              onChange={(lat, lng) => {
                update("latitude", lat);
                update("longitude", lng);
              }}
            />
            <TagInput
              label="Rivers"
              values={form.rivers}
              onChange={(v) => update("rivers", v)}
              placeholder="e.g. Madison, Snake, Yellowstone"
              optional
            />
            <TextareaInput
              label="Summary Prompt"
              value={form.summaryPrompt}
              onChange={(v) => update("summaryPrompt", v)}
              defaultValue={DEFAULT_SUMMARY_PROMPT}
            />
          </div>
        </div>
      </form>

      <div className="flex gap-2 mt-3">
        <button
          type="button"
          onClick={resetForm}
          onBlur={() => setConfirmReset(false)}
          className={`btn ${confirmReset ? "btn-warning" : "btn-ghost"}`}
        >
          {confirmReset ? "Confirm Reset" : "Reset"}
        </button>
        <button type="submit" form="flybox-form" disabled={submitting} className="btn btn-primary flex-1">
          {submitting ? <span className="loading loading-spinner loading-sm" /> : "Run Flybox"}
        </button>
      </div>
    </div>
  );
}
