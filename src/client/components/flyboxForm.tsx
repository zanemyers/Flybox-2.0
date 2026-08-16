"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { HookMark } from "@/client/components/brand";
import TagInput from "@/client/components/inputs/tagInput";
import StatusPanel from "@/client/components/statusPanel";
import { useForm } from "@/client/hooks/useForm";

const MapInput = dynamic(() => import("@/client/components/inputs/mapInput"), {
  ssr: false,
});

/* Everything the operator pays for is fixed server-side, so the form is just
   the three things a run actually varies: where, which rivers, and whether to
   summarize. There are no API key fields — Flybox supplies its own. */
interface FormState {
  latitude: number;
  longitude: number;
  rivers: string[];
  summarize: boolean;
}

const DEFAULTS: FormState = {
  latitude: 44.427963,
  longitude: -110.588455,
  rivers: [],
  summarize: true,
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

  const [form, setForm] = useState<FormState>(DEFAULTS);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    // Corrupt JSON here used to throw inside the effect and blank the whole page.
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      setForm((prev) => ({ ...prev, ...(JSON.parse(saved) as Partial<FormState>) }));
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(form));
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
    setForm(DEFAULTS);
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

          <Section label="Output">
            <label htmlFor="summarize" className="flex cursor-pointer items-start gap-3">
              <input
                id="summarize"
                type="checkbox"
                className="toggle toggle-primary mt-0.5 shrink-0"
                checked={form.summarize}
                onChange={(e) => update("summarize", e.target.checked)}
              />
              <span>
                <span className="block text-sm font-medium">Summarize with AI</span>
                <span className="block text-xs text-base-content/70">
                  {form.summarize
                    ? "Reports are condensed into one structured document, grouped by body of water."
                    : "Skips the model entirely and returns the raw crawled text — faster, and far more of it."}
                </span>
              </span>
            </label>
          </Section>
        </div>
      </form>

      {submitError && (
        <p role="alert" className="text-xs text-error">
          {submitError}
        </p>
      )}

      {/* Sibling of the form, wired by `form=`, so it sits outside the card. */}
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
