"use client";

import { useState } from "react";
import { useJobForm } from "@/hooks/useJobForm";
import { useFormState } from "@/hooks/useFormState";
import { ActiveTab, ShopReelFormState } from "@/lib/base/types/formState";

import BaseForm from "@/components/sections/baseForm";
import Tab from "@/components/inputs/tab";
import FileInput from "@/components/inputs/fileInput/fileInput";
import MapInput from "@/components/inputs/mapInput";
import TextInput from "@/components/inputs/textInput";
import InputGroupWrapper from "@/components/inputs/wrappers/InputGroupWrapper";

import { MapPin } from "lucide-react";

export default function ShopReelForm() {
    const { submit } = useJobForm<ShopReelFormState>("shopReel");
    const { form, update } = useFormState<ShopReelFormState>({
        apiKey: "",
        searchTerm: "Fly Fishing Shops",
        latitude: 44.427963,
        longitude: -110.588455,
        maxResults: 100,
    });
    const [activeTab, setActiveTab] = useState<ActiveTab>("manual");
    const [showMap, setShowMap] = useState(false);
    const [errors, setErrors] = useState<string[]>([]);

    const validateAndSubmit = async () => {
        const nextErrors: string[] = [];

        if (activeTab === "manual") {
            if (!form.apiKey) nextErrors.push("Enter an API key.");
            if (!form.searchTerm) nextErrors.push("Enter a search term.");
            if (form.latitude < -90 || form.latitude > 90)
                nextErrors.push("Latitude must be between -90 and 90.");
            if (form.longitude < -180 || form.longitude > 180)
                nextErrors.push("Longitude must be between -180 and 180.");
            if (form.maxResults < 20 || form.maxResults > 120)
                nextErrors.push("Max results must be 20–120.");
        }

        if (activeTab === "file" && !form.file) {
            nextErrors.push("Upload a simple details file.");
        }

        setErrors(nextErrors);

        if (nextErrors.length === 0) {
            try {
                const { file, ...manualPayload } = form;
                if (activeTab === "manual") await submit(manualPayload);
                else if (file) await submit(file);
            } catch (err) {
                setErrors(["Submission failed. Please try again."]);
                console.error(err);
            }
        }
    };

    return (
        <BaseForm
            buttonText="Start Search"
            errors={errors}
            onSubmit={() => validateAndSubmit()}
        >
            <div className="w-3/4 mx-auto my-8 py-8 rounded-4xl">
                <div className="tabs tabs-under tabs-md">
                    <Tab label="Manual Input">
                        <TextInput
                            type="password"
                            label="SerpAPI Key"
                            placeholder="API Key"
                            value={form.apiKey}
                            onChange={(v) => update("apiKey", v)}
                        />

                        <TextInput
                            type="text"
                            label="Search Term"
                            placeholder="e.g. Fly Fishing Shops"
                            value={form.searchTerm}
                            onChange={(v) => update("searchTerm", v)}
                        />

                        <InputGroupWrapper label="Location">
                            <TextInput
                                type="number"
                                label="Latitude"
                                value={form.latitude}
                                placeholder="Latitude"
                                step="0.000001"
                                onChange={(v) => update("latitude", Number(v))}
                                noWrapper
                            />

                            <TextInput
                                type="number"
                                label="Longitude"
                                value={form.longitude}
                                placeholder="Longitude"
                                step="0.000001"
                                onChange={(v) => update("longitude", Number(v))}
                                noWrapper
                            />

                            <button
                                type="button"
                                className="btn btn-outline"
                                onClick={() => setShowMap(true)}
                            >
                                <MapPin width={20} height={20} />
                            </button>

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
                        </InputGroupWrapper>

                        <TextInput
                            type="number"
                            label="Max Results"
                            placeholder="e.g. 100"
                            value={form.maxResults}
                            onChange={(v) => update("maxResults", Number(v))}
                        />
                    </Tab>

                    <Tab label="File Upload">
                        <FileInput
                            label="Upload Excel File"
                            fileName={form.file?.name ?? null}
                            onSelect={(file) => update("file", file)}
                        />
                    </Tab>
                </div>
            </div>
        </BaseForm>
    );
}
