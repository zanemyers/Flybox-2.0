"use client";

import { useState } from "react";

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

  return (
    <div className="w-full">
      <label htmlFor={id} className="input-label">
        {label} <span className="text-error">*</span>
      </label>
      <input
        id={id}
        name={id}
        type={type}
        placeholder={placeholder}
        required
        value={value}
        onChange={(e) => {
          setError("");
          onChange(e.target.value);
        }}
        onInvalid={(e) => {
          e.preventDefault();
          setError(e.currentTarget.validationMessage);
        }}
        className={`input input-bordered w-full ${error ? "border-error" : ""}`}
      />
      {error && <p className="text-error text-sm mt-1">• {error}</p>}
    </div>
  );
}
