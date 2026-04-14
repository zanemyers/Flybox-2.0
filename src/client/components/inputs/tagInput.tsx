"use client";

import { useId, useState } from "react";

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

  const add = (raw: string) => {
    const name = raw.trim().replace(/,+$/, "").trim();
    if (name && !values.includes(name)) onChange([...values, name]);
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
    if (val.endsWith(",")) add(val);
    else setDraft(val);
  };

  return (
    <div className="w-full">
      <label className="input-label" htmlFor={inputId}>
        {label}
        {optional && <span className="text-base-content/40 font-normal"> (optional)</span>}
      </label>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: click-to-focus wrapper for tag input */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: inner input handles keyboard interaction */}
      <div
        className="flex flex-wrap gap-1.5 items-center px-3 py-2 rounded-lg border border-base-content/20 bg-base-100 min-h-10 cursor-text"
        onClick={(e) => (e.currentTarget.querySelector("input") as HTMLInputElement)?.focus()}
      >
        {values.map((v) => (
          <span key={v} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/15 text-primary text-sm font-medium">
            {v}
            <button type="button" onClick={() => remove(v)} className="leading-none opacity-60 hover:opacity-100">
              ×
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
          className="flex-1 min-w-32 bg-transparent outline-none text-sm"
        />
      </div>
    </div>
  );
}
