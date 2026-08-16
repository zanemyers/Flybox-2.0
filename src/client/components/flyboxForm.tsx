"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { HookMark } from "@/client/components/brand";
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
  openaiApiKey: string;
  searchTerm: string;
  latitude: number;
  longitude: number;
  rivers: string[];
  summaryPrompt: string;
}

/** Single source of truth for every non-secret default. */
const DEFAULTS: Omit<FormState, "serpApiKey" | "openaiApiKey"> = {
  searchTerm: "Fly Fishing Shops",
  latitude: 44.427963,
  longitude: -110.588455,
  rivers: [],
  summaryPrompt: DEFAULT_SUMMARY_PROMPT,
};

const STORAGE_KEY = "flybox-form";

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="mt-4 border-t border-rule pt-4 first:mt-0 first:border-t-0 first:pt-0">
      <span className="eyebrow mb-2.5 block">{label}</span>
      {children}
    </section>
  );
}

export default function FlyboxForm() {
  const { jobId, submit, reset } = useForm();

  const [form, setForm] = useState<FormState>({ serpApiKey: "", openaiApiKey: "", ...DEFAULTS });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    // Corrupt JSON here used to throw inside the effect and blank the whole page
    // on every reload, with no way for the user to recover.
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved) as Partial<FormState>;
      setForm((prev) => ({ ...prev, ...parsed }));
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    const { serpApiKey: _s, openaiApiKey: _o, ...rest } = form;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(rest));
    } catch {
      /* storage full or blocked — the form still works, it just won't persist */
    }
  }, [form]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((prev) => ({ ...prev, [key]: value }));

  const resetForm = () => {
    if (!confirmReset) {
      setConfirmReset(true);
      return;
    }
    setConfirmReset(false);
    localStorage.removeItem(STORAGE_KEY);
    setForm((prev) => ({ serpApiKey: prev.serpApiKey, openaiApiKey: prev.openaiApiKey, ...DEFAULTS }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError("");
    try {
      await submit(form);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Could not start the job. Check your connection and try again.");
      setSubmitting(false);
    }
  };

  if (jobId) {
    return (
      <StatusPanel
        jobId={jobId}
        onClose={() => {
          reset();
          setSubmitting(false);
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <form
        id="flybox-form"
        noValidate
        className="panel"
        onSubmit={(e) => {
          e.preventDefault();
          if (e.currentTarget.checkValidity()) handleSubmit();
          else e.currentTarget.reportValidity();
        }}
      >
        <div className="panel-head">
          <span className="eyebrow">Run configuration</span>
          <span className="readout text-micro text-base-content/70">FB-01</span>
        </div>

        <div className="panel-body">
          <Section label="Credentials">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextInput
                type="password"
                label="SerpAPI Key"
                placeholder="Enter your SerpAPI key"
                value={form.serpApiKey}
                onChange={(v) => update("serpApiKey", v)}
              />
              <TextInput
                type="password"
                label="OpenAI API Key"
                placeholder="Enter your OpenAI API key"
                value={form.openaiApiKey}
                onChange={(v) => update("openaiApiKey", v)}
              />
            </div>
          </Section>

          <Section label="Search">
            <TextInput label="Search Term" placeholder="e.g. Fly Fishing Shops" value={form.searchTerm} onChange={(v) => update("searchTerm", v)} />
          </Section>

          <Section label="Position">
            <MapInput
              latitude={form.latitude}
              longitude={form.longitude}
              onChange={(lat, lng) => setForm((prev) => ({ ...prev, latitude: lat, longitude: lng }))}
            />
          </Section>

          <Section label="Filters">
            <TagInput label="Rivers" values={form.rivers} onChange={(v) => update("rivers", v)} placeholder="e.g. Madison, Snake, Yellowstone" optional />
          </Section>

          <Section label="Prompt">
            <TextareaInput
              label="Summary Prompt"
              value={form.summaryPrompt}
              onChange={(v) => update("summaryPrompt", v)}
              defaultValue={DEFAULT_SUMMARY_PROMPT}
            />
          </Section>
        </div>
      </form>

      {submitError && (
        <p role="alert" className="text-xs text-error">
          {submitError}
        </p>
      )}

      {/* The submit button is a sibling of the form, wired by `form=`, so it sits
          visually outside the card while still submitting it. */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={resetForm}
          onBlur={() => setConfirmReset(false)}
          className={`btn h-10 w-32 ${confirmReset ? "btn-outline btn-error" : "btn-ghost border border-rule"}`}
        >
          {confirmReset ? "Confirm reset" : "Reset"}
        </button>
        <button type="submit" form="flybox-form" disabled={submitting} aria-busy={submitting} className="btn btn-primary h-10 flex-1 gap-2">
          {submitting ? (
            <>
              <span className="run-bar w-24" />
              <span className="sr-only">Submitting</span>
            </>
          ) : (
            <>
              <HookMark className="size-4" />
              Run Flybox
            </>
          )}
        </button>
      </div>
    </div>
  );
}
