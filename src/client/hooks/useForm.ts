"use client";

import { useEffect, useState } from "react";
import type { Payload } from "@/server/handler";

const STORAGE_KEY = "flybox-jobId";

/** Tracks the in-flight job id across reloads and posts the run payload. */
export function useForm() {
  const [jobId, setJobId] = useState<string | null>(null);

  useEffect(() => {
    setJobId(localStorage.getItem(STORAGE_KEY)?.trim() || null);
  }, []);

  const submit = async (payload: Payload) => {
    const res = await fetch("/api/flybox", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const detail = await res
        .json()
        .then((d: { error?: string }) => d.error)
        .catch(() => null);
      throw new Error(detail ?? "Could not start the job. Check your connection and try again.");
    }

    const { jobId: id } = (await res.json()) as { jobId: string };
    localStorage.setItem(STORAGE_KEY, id);
    setJobId(id);
    return id;
  };

  const reset = () => {
    localStorage.removeItem(STORAGE_KEY);
    setJobId(null);
  };

  return { jobId, submit, reset };
}
