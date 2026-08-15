"use client";

import { useId, useState } from "react";
import { FiX } from "react-icons/fi";

export default function TagInput({
  label,
  values,
  onChange,
  placeholder,
  optional = false,
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  optional?: boolean;
}) {
  const inputId = useId();
  const [draft, setDraft] = useState("");

  // Splits on commas so a pasted "Madison, Snake, Yellowstone" becomes three tags.
  const add = (raw: string) => {
    const names = raw
      .split(",")
      .map((n) => n.trim())
      .filter(Boolean);
    if (names.length) {
      const merged = [...values];
      for (const name of names) if (!merged.includes(name)) merged.push(name);
      onChange(merged);
    }
    setDraft("");
  };

  const remove = (name: string) => onChange(values.filter((v) => v !== name));

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      add(draft);
    }
    if (e.key === "Backspace" && draft === "" && values.length > 0) remove(values[values.length - 1]);
  };

  const onChangeDraft = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val.includes(",")) add(val);
    else setDraft(val);
  };

  return (
    <div className="w-full">
      <div className="mb-1.5 flex items-center gap-2">
        <label className="eyebrow" htmlFor={inputId}>
          {label}
        </label>
        {optional && <span className="chip border-rule text-base-content/70">Optional</span>}
      </div>
      {/* The ring lives on the wrapper, not the inner input: the wrapper is the
          perceived control, and the input's own outline is suppressed. */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: click-to-focus wrapper for tag input */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: inner input handles keyboard interaction */}
      <div
        className="field-shell flex cursor-text flex-wrap items-center gap-1.5 py-1.5 focus-within:border-primary focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary"
        onClick={(e) => (e.currentTarget.querySelector("input") as HTMLInputElement)?.focus()}
      >
        {values.map((v) => (
          <span key={v} className="inline-flex items-center gap-1 rounded-[2px] border border-primary/70 px-2 py-0.5 text-xs font-medium text-primary">
            {v}
            <button
              type="button"
              onClick={() => remove(v)}
              aria-label={`Remove ${v}`}
              className="relative grid size-4 cursor-pointer place-items-center opacity-70 transition-opacity before:absolute before:left-1/2 before:top-1/2 before:size-6 before:-translate-x-1/2 before:-translate-y-1/2 hover:opacity-100"
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
          className="min-w-32 flex-1 self-stretch bg-transparent text-base outline-none placeholder:text-base-content/70 sm:text-sm"
        />
      </div>
    </div>
  );
}
