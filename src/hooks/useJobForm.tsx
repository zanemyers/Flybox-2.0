"use client";

import { useLocalStorage } from "@/hooks/useLocalStorage";

export function useJobForm<T extends object>(route: string) {
    const postRoute = `/api/${route}`;
    const { value: jobId, set: setJobId } = useLocalStorage(`${route}-jobId`);

    const submit = async (payload: T | File) => {
        const formData = new FormData();

        Object.entries(payload).forEach(([key, value]) => {
            formData.append(key, value instanceof File ? value : String(value ?? ""));
        });

        const res = await fetch(postRoute, { method: "POST", body: formData });
        if (!res.ok) throw new Error("Submit failed");

        const data = (await res.json()) as { jobId: string };
        setJobId(data.jobId);
        return data.jobId;
    };

    return { jobId, submit };
}