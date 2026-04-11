"use client";

import { useState, useEffect } from "react";

export function useForm<T extends object>(route: string) {
    const storageKey = `${route}-jobId`;
    const [jobId, setJobId] = useState<string | null>(null);

    useEffect(() => {
        const stored = localStorage.getItem(storageKey)?.trim() || null;
        setJobId(stored);
    }, [storageKey]);

    const submit = async (payload: T | File) => {
        const formData = new FormData();

        Object.entries(payload).forEach(([key, value]) => {
            formData.append(key, value instanceof File ? value : String(value ?? ""));
        });

        const res = await fetch(`/api/${route}`, { method: "POST", body: formData });
        if (!res.ok) throw new Error("Submit failed");

        const data = (await res.json()) as { jobId: string };
        localStorage.setItem(storageKey, data.jobId);
        setJobId(data.jobId);
        return data.jobId;
    };

    const reset = () => {
        localStorage.removeItem(storageKey);
        setJobId(null);
    };

    return { jobId, submit, reset };
}
