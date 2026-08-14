"use client";

import { useEffect, useId, useRef, useState } from "react";
import { FiEdit2, FiX } from "react-icons/fi";

export default function TextareaInput({
  label,
  value,
  onChange,
  defaultValue = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  defaultValue?: string;
}) {
  const labelId = useId();
  const [show, setShow] = useState(false);
  const [draft, setDraft] = useState(value);
  const modalRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!show) return;
    textareaRef.current?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShow(false);
        return;
      }
      if (e.key !== "Tab" || !modalRef.current) return;
      const focusable = Array.from(modalRef.current.querySelectorAll<HTMLElement>("button, textarea, [tabindex]:not([tabindex='-1'])"));
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey ? document.activeElement === first : document.activeElement === last) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [show]);

  const open = () => {
    setDraft(value);
    setShow(true);
  };
  const save = () => {
    onChange(draft);
    setShow(false);
  };

  const lineCount = value.split("\n").length;

  return (
    <>
      <div className="w-full">
        {/* A <span>, not a <label>: the control it describes lives in the modal,
            so the edit button points here with aria-labelledby instead. */}
        <span id={labelId} className="eyebrow mb-1.5 block">
          {label}
        </span>
        <div className="well flex items-start gap-3">
          <p className="line-clamp-2 flex-1 font-mono text-xs leading-[1.5] text-base-content/70">{value}</p>
          <span className="readout text-micro shrink-0 text-base-content/70">{lineCount} lines</span>
          <button
            type="button"
            className="btn btn-ghost btn-xs btn-square shrink-0 border border-rule"
            aria-labelledby={labelId}
            aria-label={`Edit ${label}`}
            onClick={open}
          >
            <FiEdit2 className="size-3" />
          </button>
        </div>
      </div>

      {show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* biome-ignore lint/a11y/noStaticElementInteractions: modal backdrop overlay */}
          {/* biome-ignore lint/a11y/useKeyWithClickEvents: Escape key handled by window keydown handler */}
          <div className="absolute inset-0 bg-base-100/70 backdrop-blur-sm" onClick={() => setShow(false)} />
          <div ref={modalRef} role="dialog" aria-modal="true" aria-labelledby={`${labelId}-title`} className="panel relative w-[90%] max-w-2xl bg-base-100">
            <div className="panel-head">
              <span id={`${labelId}-title`} className="eyebrow">
                Edit {label}
              </span>
              <button type="button" className="btn btn-ghost btn-xs btn-square" aria-label="Close" onClick={() => setShow(false)}>
                <FiX className="size-3.5" />
              </button>
            </div>
            <div className="panel-body flex flex-col gap-4">
              <textarea
                ref={textareaRef}
                className="w-full rounded-field border border-stroke bg-base-100 p-3 font-mono text-xs leading-[1.6]"
                rows={16}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
              />
              <div className="flex justify-between">
                {defaultValue && (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDraft(defaultValue)}>
                    Reset to default
                  </button>
                )}
                <div className="ml-auto flex gap-2">
                  <button type="button" className="btn btn-ghost btn-sm border border-rule" onClick={() => setShow(false)}>
                    Cancel
                  </button>
                  <button type="button" className="btn btn-primary btn-sm" onClick={save}>
                    Save
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
