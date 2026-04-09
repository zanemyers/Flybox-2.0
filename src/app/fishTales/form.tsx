"use client";

import { useState } from "react";

import BaseForm from "@/components/sections/baseForm";
import { useJobForm } from "@/hooks/useJobForm";

import FileInput from "@/components/inputs/fileInput/fileInput";
import TextInput from "@/components/inputs/textInput";
import TextAreaInput from "@/components/inputs/textAreaInput";
import CheckBoxInput from "@/components/inputs/checkBoxInput";

// Prompt template for summarizing fishing reports by body of water.
const SUMMARY_PROMPT = `
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
    * Date: June 12, 2025
      * Fly Patterns: ...
      * Colors: ...
      * Hook Sizes: ...
    * Sources: www.mdriv.org
  # 2. Snake River (river)
    * Date:...
      * Fly Patterns: ...
      * Colors: ...
      * Hook Sizes: ...
    * Sources: www.snakeriver.com, www.snriver.gov
  `.trim();

// Prompt template for merging multiple fishing report summaries into a single consolidated summary.
const MERGE_PROMPT = `
The following are summaries of fishing reports broken into sections. Please consolidate the information into a single 
summary using the same format, listing up to the 3 most recent dates separately for each body of water:
`.trim();

/** State of the form fields */
interface FormState {
    apiKey: string; // Gemini API key
    maxAge: number; // Maximum report age in days
    filterByRivers: boolean; // Whether to filter by rivers
    riverList: string; // Comma-separated rivers to filter
    file: File | null; // Uploaded starter file
    includeSiteList: boolean; // Include site list in output
    tokenLimit: number; // Token limit for API requests
    crawlDepth: number; // Depth to crawl links
    model: string; // Gemini model to use
    summaryPrompt: string; // Prompt template for summary
    mergePrompt: string; // Prompt template for merge
}

/** State of validation errors */
interface ErrorState {
    apiKeyError?: string;
    maxAgeError?: string;
    filterByRiversError?: string;
    riverListError?: string;
    fileError?: string;
    includeSiteListError?: string;
    tokenLimitError?: string;
    crawlDepthError?: string;
    modelError?: string;
    summaryPromptError?: string;
    mergePromptError?: string;
}

/** Component state */
// interface State extends BaseState {
//     form: FormState; // form field values
//     errors: ErrorState; // validation errors
// }
//
// // Keys for nested state updates
// type NestedStateKeys = "form" | "errors";
//
// // Validation error messages mapped to form fields
// const formErrors: {
//     [K in keyof FormState]: {
//         [E in keyof ErrorState]: string;
//     };
// } = {
//     apiKey: { apiKeyError: "⚠ Please enter an API key." },
//     maxAge: { maxAgeError: "⚠ Please enter a maximum age for reports." },
//     filterByRivers: { filterByRiversError: "" },
//     riverList: {
//         filterByRiversError: "⚠ Please enter a list of comma separate rivers.",
//     },
//     file: { fileError: "⚠ Please upload a file." },
//     includeSiteList: { includeSiteListError: "" },
//     tokenLimit: {
//         tokenLimitError: "⚠ Please enter a token limit between 10,000 and 100,000.",
//     },
//     crawlDepth: {
//         crawlDepthError: "⚠ Please enter a token limit between 5 and 25.",
//     },
//     model: { modelError: "⚠ Please enter a Google Gemini model." },
//     summaryPrompt: {
//         summaryPromptError: "⚠ Please enter a prompt for Gemini to summarize reports.",
//     },
//     mergePrompt: {
//         mergePromptError: "⚠ Please enter a prompt for combining the summaries.",
//     },
// };

/**
 * FishTalesForm
 *
 * Extends BaseForm to handle uploading a starter file, filtering reports,
 * and configuring advanced API settings for Gemini.
 */
export default function FishTalesForm() {
    const { jobId, submit } = useJobForm("fishTales");

    const [form, setForm] = useState<FormState>({
        apiKey: "",
        maxAge: 100,
        filterByRivers: false,
        riverList: "",
        file: null,
        includeSiteList: false,
        tokenLimit: 50000,
        crawlDepth: 15,
        model: "gemini-2.5-flash",
        summaryPrompt: SUMMARY_PROMPT,
        mergePrompt: MERGE_PROMPT,
    });

    const [errors, setErrors] = useState<ErrorState>({});

    /* ──────────────────────────────── */
    /* Helpers */
    /* ──────────────────────────────── */

    const updateForm = <K extends keyof FormState>(key: K, value: FormState[K]) => {
        setForm((prev) => ({ ...prev, [key]: value }));
    };

    const validate = (): FormState | null => {
        const nextErrors: ErrorState = {};

        if (!form.apiKey) nextErrors.apiKeyError = "⚠ Please enter an API key.";
        if (form.maxAge < 10) nextErrors.maxAgeError = "⚠ Minimum is 10 days.";
        if (form.filterByRivers && !form.riverList) {
            nextErrors.riverListError = "⚠ Enter comma-separated rivers.";
        }
        if (!form.file) nextErrors.fileError = "⚠ Please upload a file.";
        if (form.tokenLimit < 10000 || form.tokenLimit > 100000) {
            nextErrors.tokenLimitError = "⚠ Token limit must be 10,000–100,000.";
        }
        if (form.crawlDepth < 5 || form.crawlDepth > 25) {
            nextErrors.crawlDepthError = "⚠ Crawl depth must be 5–25.";
        }
        if (!form.model) nextErrors.modelError = "⚠ Please specify a model.";

        setErrors(nextErrors);

        return Object.keys(nextErrors).length === 0 ? { ...form } : null;
    };

    /* ──────────────────────────────── */
    /* Progress panel */
    /* ──────────────────────────────── */

    if (jobId) {
        return (
            <div className="w-full max-w-3xl">
                {/* ProgressPanel already handled in BaseForm before — now explicit */}
                {/* You already have this pattern elsewhere */}
                {/* Keep as-is */}
            </div>
        );
    }

    /* ──────────────────────────────── */
    /* Render */
    /* ──────────────────────────────── */

    return (
        <BaseForm
            buttonText="Start Scrape"
            onSubmit={() => {
                const payload = validate();
                if (payload) submit(payload);
            }}
        >
            <TextInput
                type="password"
                label="Gemini API Key"
                placeholder="API Key"
                value={form.apiKey}
                onChange={(v) => updateForm("apiKey", v)}
                error={errors.apiKeyError}
            />

            <TextInput
                type="number"
                label="Max Report Age"
                placeholder="e.g. 100"
                value={form.maxAge}
                onChange={(v) => updateForm("maxAge", Number(v))}
                error={errors.maxAgeError}
            />

            <CheckBoxInput
                label="Filter by Rivers"
                checked={form.filterByRivers}
                onChange={(v) => updateForm("filterByRivers", v)}
            />

            {form.filterByRivers && (
                <TextInput
                    type="text"
                    label="River Names"
                    placeholder="e.g. Madison, Snake, Yellowstone"
                    value={form.riverList}
                    onChange={(v) => updateForm("riverList", v)}
                    error={errors.riverListError}
                />
            )}

            <FileInput
                label="Import Starter File"
                fileName={form.file?.name ?? null}
                onSelect={(file) => updateForm("file", file)}
            />

            <details className="form-control">
                <summary className="font-medium cursor-pointer">
                    Advanced Settings
                </summary>

                <CheckBoxInput
                    label="Include Site List"
                    checked={form.includeSiteList}
                    onChange={(v) => updateForm("includeSiteList", v)}
                />

                <TextInput
                    type="number"
                    label="Token Limit"
                    placeholder="e.g. 50,000"
                    value={form.tokenLimit}
                    onChange={(v) => updateForm("tokenLimit", Number(v))}
                    error={errors.tokenLimitError}
                />

                <TextInput
                    type="number"
                    label="Crawl Depth"
                    placeholder="e.g. 25"
                    value={form.crawlDepth}
                    onChange={(v) => updateForm("crawlDepth", Number(v))}
                    error={errors.crawlDepthError}
                />

                <TextInput
                    type="text"
                    label="Gemini Model"
                    placeholder="e.g. gemini-1.5-pro or gemini-2.5-flash"
                    value={form.model}
                    onChange={(v) => updateForm("model", v)}
                    error={errors.modelError}
                />

                <TextAreaInput
                    label="Summary Prompt"
                    placeholder="Enter summary prompt here..."
                    rows={10}
                    value={form.summaryPrompt}
                    onChange={(v) => updateForm("summaryPrompt", v)}
                />

                <TextAreaInput
                    label="Merge Prompt"
                    placeholder="Enter merge prompt here..."
                    rows={4}
                    value={form.mergePrompt}
                    onChange={(v) => updateForm("mergePrompt", v)}
                />
            </details>
        </BaseForm>
    );
}
