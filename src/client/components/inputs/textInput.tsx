"use client";

import { useState } from "react";
import { FiAlertCircle, FiEye, FiEyeOff } from "react-icons/fi";

export default function TextInput({
  label,
  type = "text",
  placeholder,
  value,
  onChange,
}: {
  label: string;
  type?: "text" | "password";
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = label.toLowerCase().replace(/\s+/g, "-");
  const [error, setError] = useState("");
  const [revealed, setRevealed] = useState(false);

  const secret = type === "password";

  return (
    <div className="w-full">
      <label htmlFor={id} className="eyebrow mb-1.5 block">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={id}
          type={secret && !revealed ? "password" : "text"}
          placeholder={placeholder}
          required
          value={value}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(e) => {
            setError("");
            onChange(e.target.value);
          }}
          onInvalid={(e) => {
            e.preventDefault();
            setError(e.currentTarget.validationMessage);
          }}
          className={`field ${secret ? "pe-10" : ""} ${error ? "border-error" : ""}`}
        />
        {secret && (
          <button
            type="button"
            onClick={() => setRevealed((r) => !r)}
            aria-pressed={revealed}
            aria-label={revealed ? `Hide ${label}` : `Show ${label}`}
            className="absolute inset-y-0 end-0 grid w-10 place-items-center text-base-content/70 transition-colors hover:text-base-content"
          >
            {revealed ? <FiEyeOff className="size-4" /> : <FiEye className="size-4" />}
          </button>
        )}
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1 flex items-start gap-1.5 text-xs text-error">
          <FiAlertCircle className="mt-px size-3.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
