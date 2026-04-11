"use client";

import { useEffect, useRef, useState } from "react";

interface FileData {
    name: string;
    buffer?: string;
}

interface JobUpdate {
    message: string;
    status: Status;
    files: FileData[];
}

type Status = "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "FAILED";

export default function StatusPanel({ route, jobId, onClose }: { route: string; jobId: string; onClose: () => void }) {
    const [status, setStatus] = useState<Status>("IN_PROGRESS");
    const [files, setFiles] = useState<FileData[]>([]);
    const progressAreaRef = useRef<HTMLPreElement>(null);
    const fileUrlsRef = useRef<Map<string, string>>(new Map());
    const downloadedFilesRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        const saved = localStorage.getItem(`${route}-files`);
        if (saved) {
            setFiles((JSON.parse(saved) as string[]).map((name) => ({ name })));
        }
    }, [route]);

    useEffect(() => {
        if (files.length) {
            localStorage.setItem(`${route}-files`, JSON.stringify(files.map((f) => f.name)));
        }
    }, [files, route]);

    useEffect(() => {
        const intervalId = setInterval(async () => {
            const res = await fetch(`/api/${route}/${jobId}/updates`);
            const data = (await res.json()) as JobUpdate;

            if (progressAreaRef.current) progressAreaRef.current.textContent = data.message;

            setStatus(data.status);
            handleIncomingFiles(data.files);

            if (data.status !== "IN_PROGRESS") clearInterval(intervalId);
        }, 1000);

        return () => clearInterval(intervalId);
    }, [route, jobId]);

    const getFileUrl = (file: FileData) => {
        if (!file.buffer) return;
        if (!fileUrlsRef.current.has(file.name)) {
            const blob = new Blob([Uint8Array.from(atob(file.buffer), (c) => c.charCodeAt(0))]);
            fileUrlsRef.current.set(file.name, URL.createObjectURL(blob));
        }
        return fileUrlsRef.current.get(file.name)!;
    };

    const handleIncomingFiles = (incoming: FileData[]) => {
        setFiles((current) => {
            const updated = current.map((cf) => {
                const match = incoming.find((f) => f.name === cf.name && f.buffer);
                return match ? { ...cf, buffer: match.buffer } : cf;
            });

            const existingNames = new Set(current.map((f) => f.name));
            const newFiles = incoming.filter((f) => !existingNames.has(f.name));

            newFiles.forEach((file) => {
                if (file.buffer && !downloadedFilesRef.current.has(file.name)) {
                    const url = getFileUrl(file);
                    if (url) {
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = file.name;
                        a.click();
                    }
                    downloadedFilesRef.current.add(file.name);
                }
            });

            return [...updated, ...newFiles];
        });
    };

    const handleCancel = async () => {
        await fetch(`/api/${route}/${jobId}/cancel`, { method: "POST" });
    };

    const onClosePanel = () => {
        fileUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
        fileUrlsRef.current.clear();
        localStorage.removeItem(`${route}-files`);
        onClose();
    };

    const isRunning = status === "IN_PROGRESS";

    return (
        <div className="app-panel">
            <div className="card-base">
                <div className="card-body flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                        <h2 className="card-title">{isRunning ? "Running Search…" : "Job Complete"}</h2>
                        <span className={`badge ${isRunning ? "badge-info" : "badge-success"}`}>{status}</span>
                    </div>

                    <pre ref={progressAreaRef} className="text-sm bg-base-200 rounded p-3 max-h-64 overflow-y-auto" />

                    {files.some((f) => f.buffer) && (
                        <div>
                            <div className="divider">Files</div>
                            <div className="space-y-2">
                                {files.map((file) => file.buffer && (
                                    <a key={file.name} href={getFileUrl(file)} download={file.name} className="link link-primary block text-sm">
                                        {file.name}
                                    </a>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="card-actions justify-end">
                        <button className={`btn w-full ${isRunning ? "btn-error" : "btn-secondary"}`} onClick={isRunning ? handleCancel : onClosePanel}>
                            {isRunning ? "Cancel" : "Close"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
