"use client";

import { useState } from "react";

export default function NumberInput({ label, placeholder, value, step, min, max, readOnly, onChange }: {
    label: string;
    placeholder?: string;
    value: number;
    step?: number;
    min?: number;
    max?: number;
    readOnly?: boolean;
    onChange?: (value: number) => void;
}) {
    const id = label.toLowerCase().replace(/\s+/g, "-");
    const [error, setError] = useState("");

    return (
        <div className="w-full">
            <label htmlFor={id} className="input-label">{label} <span className="text-error">*</span></label>
            <input
                id={id}
                name={id}
                type="number"
                placeholder={placeholder}
                step={step}
                min={min}
                max={max}
                required
                readOnly={readOnly}
                value={value}
                readOnly={readOnly ?? !onChange}
                onChange={onChange ? (e) => { setError(""); onChange(Number(e.target.value)); } : undefined}
                onInvalid={(e) => { e.preventDefault(); setError(e.currentTarget.validationMessage); }}
                className={`input input-bordered w-full ${(readOnly ?? !onChange) ? "bg-base-200 text-base-content/50 cursor-default select-none" : ""} ${error ? "border-error" : ""}`}
            />
            {error && <p className="text-error text-sm mt-1">• {error}</p>}
        </div>
    );
}
