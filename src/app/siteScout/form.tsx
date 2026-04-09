"use client";

import { useState } from "react";
import { useJobForm } from "@/hooks/useJobForm";
import { useFormState } from "@/hooks/useFormState";
import { SiteScoutFormState } from "@/lib/base/types/formState";
import BaseForm from "@/components/sections/baseForm";
import FileInput from "@/components/inputs/fileInput/fileInput";

export default function SiteScoutForm() {
    const { submit } = useJobForm<SiteScoutFormState>("siteScout");
    const { form, update } = useFormState<SiteScoutFormState>({
        shopReelFile: null,
        fishTalesFile: null,
    });
    const [errors, setErrors] = useState<string[]>([]);

    const validateAndSubmit = async () => {
        const nextErrors: string[] = [];

        if (!form.shopReelFile) nextErrors.push("Upload your ShopReel file.");
        if (!form.fishTalesFile)
            nextErrors.push("Upload your FishTales starter file or use the example file.");

        setErrors(nextErrors);

        if (nextErrors.length === 0) {
            try {
                await submit(form);
            } catch (err) {
                setErrors(["Submission failed. Please try again."]);
                console.error(err);
            }
        }
    };

    return (
        <BaseForm buttonText="Search" errors={errors} onSubmit={validateAndSubmit}>
            <FileInput
                className="pb-8"
                label="Import ShopReel File"
                fileName={form.shopReelFile?.name ?? null}
                onSelect={(file) => update("shopReelFile", file)}
            />

            <FileInput
                label="Import FishTales Starter File"
                fileName={form.fishTalesFile?.name ?? null}
                onSelect={(file) => update("fishTalesFile", file)}
            />
        </BaseForm>
    );
}
