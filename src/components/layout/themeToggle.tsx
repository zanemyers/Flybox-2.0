"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

export default function ThemeToggle() {
    const [dark, setDark] = useState(false);

    useEffect(() => {
        const saved = localStorage.getItem("theme");
        const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        const isDark = saved ? saved === "dark" : prefersDark;
        setDark(isDark);
    }, []);

    const toggle = () => {
        const next = !dark;
        setDark(next);
        const theme = next ? "dark" : "light";
        localStorage.setItem("theme", theme);
        document.documentElement.setAttribute("data-theme", theme);
        document.documentElement.style.colorScheme = theme;
    };

    return (
        <button
            type="button"
            onClick={toggle}
            className="btn btn-ghost btn-sm btn-circle"
            aria-label="Toggle theme"
        >
            {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
    );
}
