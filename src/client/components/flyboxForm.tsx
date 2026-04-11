"use client";

import { useState } from "react";
import { FaMapPin } from "react-icons/fa";
import dynamic from "next/dynamic";
import { useForm } from "@/client/hooks/useForm";
import StatusPanel from "@/client/components/statusPanel";

const MapInput = dynamic(() => import("@/client/components/mapInput"), { ssr: false });

const DEFAULT_SUMMARY_PROMPT = `
For each river or body of water mentioned, create a bulleted list that follows the template below.
- If you cannot find information for a bullet, leave it blank.
- If the body of water is mentioned more than once, summarize the info into a single entry, with each of the 3 most recent dates broken out separately.
- If a date is in the body of the text and not in the date field, move it to the date field.
- If an article contains reports for multiple bodies of water, break them into separate entries based on the body of water.
- If a river has multiple water types, list all of them next to the body of water's name.
- Include the list of sources used for the summary

# 1. Madison River (Water Type/s, e.g., river, lake, reservoir, creek, fork)
  * Date: June 19, 2025
    * Fly Patterns: ...
    * Colors: ...
    * Hook Sizes: ...
  * Date: June 13, 2025
    * Fly Patterns: ...
    * Colors: ...
    * Hook Sizes: ...
  * Sources: www.mdriv.org
# 2. Snake River (river)
  * Date:...
    * Fly Patterns: ...
    * Colors: ...
    * Hook Sizes: ...
  * Sources: www.snakeriver.com
`.trim();

interface FormState {
    serpApiKey: string;
    geminiApiKey: string;
    searchTerm: string;
    latitude: number;
    longitude: number;
    maxAge: number;
    filterByRivers: boolean;
    riverList: string;
    summaryPrompt: string;
}

function TextInput({ label, type, placeholder, value, step, onChange }: {
    label: string;
    type: "text" | "password" | "number";
    placeholder: string;
    value: string | number;
    step?: string;
    onChange: (value: string) => void;
}) {
    const id = label.toLowerCase().replace(/\s+/g, "-");
    return (
        <div className="w-full">
            <label htmlFor={id} className="input-label">{label}</label>
            <input
                id={id}
                name={id}
                type={type}
                placeholder={placeholder}
                step={step}
                value={String(value)}
                onChange={(e) => onChange(e.target.value)}
                className="input input-bordered w-full"
            />
        </div>
    );
}

function TextAreaInput({ label, placeholder, rows, value, onChange }: {
    label: string;
    placeholder?: string;
    rows: number;
    value: string;
    onChange: (value: string) => void;
}) {
    const id = label.toLowerCase().replace(/\s+/g, "-");
    return (
        <div className="w-full">
            <label htmlFor={id} className="input-label">{label}</label>
            <textarea
                id={id}
                className="textarea textarea-bordered w-full"
                placeholder={placeholder}
                rows={rows}
                value={value}
                onChange={(e) => onChange(e.target.value)}
            />
        </div>
    );
}

function CheckBoxInput({ label, checked, onChange }: {
    label: string;
    checked: boolean;
    onChange: (value: boolean) => void;
}) {
    const id = label.toLowerCase().replace(/\s+/g, "-");
    return (
        <div className="flex items-center gap-2">
            <input
                id={id}
                type="checkbox"
                className="checkbox bg-base-100"
                checked={checked}
                onChange={(e) => onChange(e.target.checked)}
            />
            <label htmlFor={id} className="input-label mb-0 cursor-pointer">{label}</label>
        </div>
    );
}

export default function FlyboxForm({
    defaultSerpApiKey = "",
    defaultGeminiApiKey = "",
}: {
    defaultSerpApiKey?: string;
    defaultGeminiApiKey?: string;
}) {
    const { jobId, submit, reset } = useForm("flybox");

    const [form, setForm] = useState<FormState>({
        serpApiKey: defaultSerpApiKey,
        geminiApiKey: defaultGeminiApiKey,
        searchTerm: "Fly Fishing Shops",
        latitude: 44.427963,
        longitude: -110.588455,
        maxAge: 100,
        filterByRivers: false,
        riverList: "",
        summaryPrompt: DEFAULT_SUMMARY_PROMPT,
    });

    const [showMap, setShowMap] = useState(false);
    const [errors, setErrors] = useState<string[]>([]);

    const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
        setForm((prev) => ({ ...prev, [key]: value }));

    const validateAndSubmit = async () => {
        const nextErrors: string[] = [];

        if (!form.serpApiKey) nextErrors.push("Enter a SerpAPI key.");
        if (!form.geminiApiKey) nextErrors.push("Enter a Gemini API key.");
        if (!form.searchTerm) nextErrors.push("Enter a search term.");
        if (form.latitude < -90 || form.latitude > 90) nextErrors.push("Latitude must be between -90 and 90.");
        if (form.longitude < -180 || form.longitude > 180) nextErrors.push("Longitude must be between -180 and 180.");
        if (form.maxAge < 10) nextErrors.push("Max report age must be at least 10 days.");
        if (form.filterByRivers && !form.riverList.trim()) nextErrors.push("Enter at least one river name.");

        setErrors(nextErrors);
        if (nextErrors.length > 0) return;

        try {
            await submit({ ...form, filterByRivers: String(form.filterByRivers) } as unknown as FormState);
        } catch {
            setErrors(["Submission failed. Please try again."]);
        }
    };

    if (jobId) {
        return <StatusPanel route="flybox" jobId={jobId} onClose={reset} />;
    }

    return (
        <div className="app-panel">
            <form className="card h-full" onSubmit={(e) => { e.preventDefault(); validateAndSubmit(); }}>
                <div className="card-body">
                    <div className="space-y-4">
                        <TextInput
                            type="password"
                            label="SerpAPI Key"
                            placeholder="Enter your SerpAPI key"
                            value={form.serpApiKey}
                            onChange={(v) => update("serpApiKey", v)}
                        />
                        <TextInput
                            type="password"
                            label="Gemini API Key"
                            placeholder="Enter your Gemini API key"
                            value={form.geminiApiKey}
                            onChange={(v) => update("geminiApiKey", v)}
                        />
                        <TextInput
                            type="text"
                            label="Search Term"
                            placeholder="e.g. Fly Fishing Shops"
                            value={form.searchTerm}
                            onChange={(v) => update("searchTerm", v)}
                        />

                        <div>
                            <div className="grid grid-cols-[1fr_1fr_auto] gap-x-2">
                                <label className="input-label">Latitude</label>
                                <label className="input-label">Longitude</label>
                                <span />
                                <input
                                    type="number"
                                    className="input input-bordered w-full"
                                    placeholder="44.427963"
                                    step="0.000001"
                                    value={form.latitude}
                                    onChange={(e) => update("latitude", Number(e.target.value))}
                                />
                                <input
                                    type="number"
                                    className="input input-bordered w-full"
                                    placeholder="-110.588455"
                                    step="0.000001"
                                    value={form.longitude}
                                    onChange={(e) => update("longitude", Number(e.target.value))}
                                />
                                <button
                                    type="button"
                                    className="btn bg-base-300 border border-base-content/20 hover:bg-base-content/20"
                                    onClick={() => setShowMap(true)}
                                    aria-label="Pick location on map"
                                >
                                    <FaMapPin size={18} className="text-primary" />
                                </button>
                            </div>
                            <MapInput
                                show={showMap}
                                latitude={form.latitude}
                                longitude={form.longitude}
                                onClose={() => setShowMap(false)}
                                onChange={(lat, lng) => {
                                    update("latitude", lat);
                                    update("longitude", lng);
                                }}
                            />
                        </div>

                        <details>
                            <summary className="font-medium cursor-pointer select-none">Advanced Settings</summary>
                            <div className="space-y-4 mt-4">
                                <TextInput
                                    type="number"
                                    label="Max Report Age (days)"
                                    placeholder="e.g. 100"
                                    value={form.maxAge}
                                    onChange={(v) => update("maxAge", Number(v))}
                                />
                                <CheckBoxInput
                                    label="Filter by Rivers"
                                    checked={form.filterByRivers}
                                    onChange={(v) => update("filterByRivers", v)}
                                />
                                {form.filterByRivers && (
                                    <TextInput
                                        type="text"
                                        label="River Names"
                                        placeholder="e.g. Madison, Snake, Yellowstone"
                                        value={form.riverList}
                                        onChange={(v) => update("riverList", v)}
                                    />
                                )}
                                <TextAreaInput
                                    label="Summary Prompt"
                                    placeholder="Enter summary prompt..."
                                    rows={12}
                                    value={form.summaryPrompt}
                                    onChange={(v) => update("summaryPrompt", v)}
                                />
                            </div>
                        </details>
                    </div>
                </div>

                <div className="card-body flex flex-col justify-end">
                    {errors.length > 0 && (
                        <ul className="text-sm text-error">
                            {errors.map((error) => <li key={error}>{error}</li>)}
                        </ul>
                    )}
                    <button type="submit" className="btn btn-primary w-full">Run Flybox</button>
                </div>
            </form>
        </div>
    );
}
