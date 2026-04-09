"use client";

import { useState, useEffect } from "react";

export function useLocalStorage(key: string) {
    const [value, setValue] = useState<string | null>(null);

    // Check for valid value
    const isValid = (str: string | null | undefined) => !!str?.trim();

    // Clear the local storage and state
    const reset = () => {
        localStorage.removeItem(key);
        setValue(null);
    };


    // If you have a valid value set the local storage and state otherwise clear it
    const set = (val: string) => {
        if (isValid(val)){
            localStorage.setItem(key, val);
            setValue(val);
        } else reset()
    };

    // Load from localStorage on mount
    useEffect(() => {
        const stored = localStorage.getItem(key);
        if (isValid(stored)) setValue(stored);
        else reset()
    }, [key]);

    return { value, set, reset };
}
