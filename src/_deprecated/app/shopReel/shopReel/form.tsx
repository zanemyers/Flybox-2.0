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

import { MapPin } from "lucide-react";

export default function ShopReelForm({ defaultApiKey = "" }: { defaultApiKey?: string }) {
    const { submit } = useJobForm<ShopReelFormState>("shopReel");
    const { form, update } = useFormState<ShopReelFormState>({
        apiKey: defaultApiKey,
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
            className="card h-full"
            noPanel
        >
            <div className="tabs tabs-lift tabs-md">
                <Tab
                    label="Manual Input"
                    defaultChecked
                    onChange={() => setActiveTab("manual")}
                >
                    <div className="space-y-4">
                        <TextInput
                            type="password"
                            label="SerpAPI Key"
                            placeholder="Enter your SerpAPI key"
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
                                    className="btn btn-outline"
                                    onClick={() => setShowMap(true)}
                                    aria-label="Pick location on map"
                                >
                                    <MapPin size={18} />
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

                        <TextInput
                            type="number"
                            label="Max Results"
                            placeholder="e.g. 100"
                            value={form.maxResults}
                            onChange={(v) => update("maxResults", Number(v))}
                        />
                    </div>
                </Tab>

                <Tab
                    label="File Upload"
                    onChange={() => setActiveTab("file")}
                >
                    <FileInput
                        label="Upload Excel File"
                        fileName={form.file?.name ?? null}
                        onSelect={(file) => update("file", file)}
                    />
                </Tab>
            </div>
        </BaseForm>
    );
}
