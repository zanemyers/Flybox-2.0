"use client";

import { type ChangeEvent, type KeyboardEvent, useId, useState } from "react";
import { FiX } from "react-icons/fi";

export default function TagInput({
  label,
  values,
  onChange,
  placeholder,
  optional = false,
  max = Number.POSITIVE_INFINITY,
  maxLength,
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  optional?: boolean;
  /** Refused past this many. The server rejects the run otherwise, which the user only found out after pressing Run. */
  max?: number;
  /** slice(0, undefined) is the whole string, so leaving this off means no limit. */
  maxLength?: number;
}) {
  const inputId = useId();
  const [draft, setDraft] = useState("");

  // Splits on commas so a pasted "Madison, Snake, Yellowstone" becomes three tags.
  const add = (raw: string) => {
    const names = raw
      .split(",")
      .map((n) => n.trim().slice(0, maxLength))
      .filter(Boolean);
    const merged = [...values];
    for (const name of names) if (!merged.includes(name) && merged.length < max) merged.push(name);
    // Only when something landed: every name could be a duplicate or past the cap.
    if (merged.length > values.length) onChange(merged);
    setDraft("");
  };

  const remove = (name: string) => onChange(values.filter((v) => v !== name));

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      add(draft);
    }
    if (e.key === "Backspace" && draft === "" && values.length > 0) remove(values[values.length - 1]);
  };

  const onChangeDraft = (e: ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val.includes(",")) add(val);
    else setDraft(val);
  };

  return (
    <div className="w-full">
      <div className="mb-2.5 flex items-center gap-2">
        <label className="eyebrow" htmlFor={inputId}>
          {label}
        </label>
        {optional && (
          <span id={`${inputId}-opt`} className="chip border-rule text-base-content/70">
            Optional
          </span>
        )}
        {values.length >= max && (
          <span id={`${inputId}-max`} className="chip border-warning text-warning">
            Max {max}
          </span>
        )}
      </div>
      {/* The ring lives on the wrapper, not the inner input: the wrapper is the perceived control, and the input's own outline is suppressed. */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: click-to-focus wrapper for tag input */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: inner input handles keyboard interaction */}
      <div
        className="field-shell flex cursor-text flex-wrap items-center gap-1.5 py-1.5 has-[input:focus-visible]:border-primary has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-primary"
        onClick={(e) => e.currentTarget.querySelector("input")?.focus()}
      >
        {values.map((v) => (
          <span key={v} className="tag">
            {v}
            <button
              type="button"
              onClick={() => remove(v)}
              aria-label={`Remove ${v}`}
              className="relative grid size-4 cursor-pointer place-items-center text-primary/70 transition-colors before:absolute before:left-1/2 before:top-1/2 before:size-6 before:-translate-x-1/2 before:-translate-y-1/2 hover:text-primary"
            >
              <FiX className="size-2.5" />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={draft}
          onChange={onChangeDraft}
          onKeyDown={onKeyDown}
          onBlur={() => {
            if (draft.trim()) add(draft);
          }}
          placeholder={values.length === 0 ? placeholder : ""}
          id={inputId}
          aria-describedby={[optional ? `${inputId}-opt` : null, values.length >= max ? `${inputId}-max` : null].filter(Boolean).join(" ") || undefined}
          className="min-w-32 flex-1 self-stretch bg-transparent text-base outline-none placeholder:text-base-content/70 sm:text-sm"
        />
      </div>
    </div>
  );
}
