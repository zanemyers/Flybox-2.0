"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { HookMark } from "@/client/components/brand";
import TagInput from "@/client/components/inputs/tagInput";
import StatusPanel from "@/client/components/statusPanel";
import { useForm } from "@/client/hooks/useForm";
// Type-only, so nothing from the server module reaches the bundle.
import type { Payload } from "@/server/handler";
import { MAX_RIVER_CHARS, MAX_RIVERS } from "@/shared/limits";

const MapInput = dynamic(() => import("@/client/components/inputs/mapInput"), {
  ssr: false,
});

/* The four things a run varies: where, which rivers, whether to summarize, whether to build the workbook. Typed as Payload because it IS the request body, not a twin to keep in step. */
type FormState = Payload;

const DEFAULTS: FormState = {
  latitude: 44.427963,
  longitude: -110.588455,
  rivers: [],
  summarize: true,
  shopDirectory: true,
};

const STORAGE_KEY = "flybox-form";

/* `label` is optional: a section holding one already-labeled control does not need a header above its header. */
function Section({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <section className="mt-4 border-t border-rule pt-4 first:mt-0 first:border-t-0 first:pt-0">
      {label && <span className="eyebrow mb-2.5 block">{label}</span>}
      {children}
    </section>
  );
}

/* The description is aria-describedby, not part of the label: inside the <label> it became the accessible name, which then changed wholesale every time the toggle flipped. */
function Toggle({
  id,
  label,
  description,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start gap-3">
      <input
        id={id}
        type="checkbox"
        aria-describedby={`${id}-desc`}
        className="toggle toggle-primary mt-0.5 shrink-0"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <div>
        <label htmlFor={id} className="block cursor-pointer text-sm font-medium">
          {label}
        </label>
        <span id={`${id}-desc`} className="block text-xs text-base-content/70">
          {description}
        </span>
      </div>
    </div>
  );
}

export default function FlyboxForm() {
  const { jobId, submit, reset } = useForm();

  const [form, setForm] = useState<FormState>(DEFAULTS);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  /* Closing the panel remounts this form, and without this focus lands on <body>. Gated on the close action so it never steals focus on a normal load. */
  const [returnedFromRun, setReturnedFromRun] = useState(false);

  useEffect(() => {
    if (!returnedFromRun) return;
    formRef.current?.focus();
    setReturnedFromRun(false);
  }, [returnedFromRun]);

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
    if (submitting) return;
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
          setReturnedFromRun(true);
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <form
        ref={formRef}
        id="flybox-form"
        aria-labelledby="run-config"
        tabIndex={-1}
        noValidate
        className="panel focus:outline-none"
        onSubmit={(e) => {
          e.preventDefault();
          if (e.currentTarget.checkValidity()) handleSubmit();
          else e.currentTarget.reportValidity();
        }}
      >
        <div className="panel-head">
          <h2 id="run-config" className="eyebrow">
            Run configuration
          </h2>
          {/* aria-hidden: instrument-panel decoration, not a job id or a version. */}
          <span aria-hidden="true" className="readout text-micro uppercase tracking-[0.08em] text-base-content/70">
            FB-01
          </span>
        </div>

        <div className="panel-body">
          <Section label="Position">
            <MapInput
              latitude={form.latitude}
              longitude={form.longitude}
              onChange={(lat, lng) => setForm((prev) => ({ ...prev, latitude: lat, longitude: lng }))}
            />
          </Section>

          <Section>
            <TagInput
              label="Rivers"
              values={form.rivers}
              onChange={(v) => update("rivers", v)}
              placeholder="e.g. Madison, Snake, Yellowstone"
              optional
              max={MAX_RIVERS}
              maxLength={MAX_RIVER_CHARS}
            />
          </Section>

          <Section>
            <div className="flex flex-col gap-4">
              <Toggle
                id="shop-directory"
                label="Shop directory"
                checked={form.shopDirectory}
                onChange={(v) => update("shopDirectory", v)}
                description={
                  form.shopDirectory
                    ? "A spreadsheet of every shop found: contact details, socials, and whether it sells online."
                    : "Only the report is produced. Shops are still searched — the report is built from their sites."
                }
              />
              <Toggle
                id="summarize"
                label="Summarize with AI"
                checked={form.summarize}
                onChange={(v) => update("summarize", v)}
                description={
                  form.summarize
                    ? "Reports are condensed into one structured document, grouped by body of water."
                    : "Skips the model entirely and returns the raw crawled text — faster, and far more of it."
                }
              />
            </div>
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
          className={`btn h-10 w-32 ${confirmReset ? "btn-outline btn-error" : "btn-ghost border border-stroke"}`}
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
