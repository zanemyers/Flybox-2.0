"use client";

import { useEffect } from "react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    useEffect(() => {
        console.error(error);
    }, [error]);

    return (
        <div className="w-[85%] text-center mx-auto py-12">
            <h1 className="mb-3 text-secondary"><b>500</b></h1>
            <h1 className="text-primary">Something Went Wrong</h1>
            <p className="lead">An unexpected error occurred. Try refreshing the page or heading back home.</p>
            <div className="flex justify-center gap-4 mt-6">
                <button className="btn btn-primary btn-lg px-4" onClick={reset}>Try Again</button>
            </div>
        </div>
    );
}
