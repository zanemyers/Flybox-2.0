"use client";

import { useEffect, useRef, useState } from "react";
import { FaPencilAlt } from "react-icons/fa";

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

  return (
    <>
      <div className="w-full">
        {/* biome-ignore lint/a11y/noLabelWithoutControl: label describes preview display; textarea is in modal */}
        <label className="input-label">
          {label} <span className="text-error">*</span>
        </label>
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg border border-base-content/20 bg-base-100/50">
          <p className="flex-1 text-sm text-base-content/60 font-mono line-clamp-2">{value}</p>
          <button type="button" className="btn btn-ghost btn-xs btn-square shrink-0 mt-0.5" aria-label={`Edit ${label}`} onClick={open}>
            <FaPencilAlt size={12} />
          </button>
        </div>
      </div>

      {show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* biome-ignore lint/a11y/noStaticElementInteractions: modal backdrop overlay */}
          {/* biome-ignore lint/a11y/useKeyWithClickEvents: Escape key handled by window keydown handler */}
          <div className="absolute inset-0 bg-black/50" onClick={() => setShow(false)} />
          <div ref={modalRef} className="relative bg-base-100 rounded-box shadow-xl w-[90%] max-w-2xl p-6 flex flex-col gap-4">
            <h3 className="text-lg font-semibold">Edit {label}</h3>
            <textarea
              ref={textareaRef}
              className="textarea textarea-bordered w-full font-mono text-sm"
              rows={16}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
            <div className="flex justify-between">
              {defaultValue && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDraft(defaultValue)}>
                  Reset to Default
                </button>
              )}
              <div className="flex gap-2 ml-auto">
                <button type="button" className="btn btn-ghost" onClick={() => setShow(false)}>
                  Cancel
                </button>
                <button type="button" className="btn btn-primary" onClick={save}>
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
