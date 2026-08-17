"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { FiMoon, FiSun } from "react-icons/fi";
import { HookMark } from "@/client/components/brand";

const navLinks = [
  { label: "Home", href: "/" },
  { label: "Runs", href: "/runs" },
  { label: "How it works", href: "/how-it-works" },
  { label: "About", href: "/about" },
];

function applyTheme(isDark: boolean) {
  const theme = isDark ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", theme);
  document.documentElement.style.colorScheme = theme;
  try {
    localStorage.setItem("flybox-theme", theme);
  } catch {
    /* private browsing — the choice just won't persist */
  }
}

export default function Header() {
  const currentPath = usePathname();
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.getAttribute("data-theme") === "dark");
  }, []);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    applyTheme(next);
  };

  return (
    <header className="sticky top-0 z-40 h-14 border-b border-rule bg-base-100/85 backdrop-blur-sm">
      <div className="shell flex h-full items-center justify-between gap-4">
        <Link href="/" className="flex items-baseline gap-2.5">
          <HookMark className="size-5 shrink-0 self-center text-primary" />
          <span className="text-[1.0625rem] font-semibold tracking-[-0.01em]">FLYBOX</span>
          <span className="eyebrow hidden sm:inline">/ Rescue River</span>
        </Link>

        <nav className="flex h-full min-w-0 items-center gap-3 sm:gap-5">
          <ul className="flex h-full min-w-0 list-none items-stretch gap-3 overflow-x-auto overflow-y-hidden whitespace-nowrap sm:gap-5 sm:overflow-visible">
            {navLinks.map(({ label, href }) => {
              const active = currentPath === href;
              return (
                <li key={label}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={`eyebrow relative flex h-full items-center transition-colors hover:text-primary ${active ? "text-primary" : ""}`}
                  >
                    {label}
                    {active && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-primary" />}
                  </Link>
                </li>
              );
            })}
          </ul>
          <span className="hidden h-4 w-px bg-rule sm:block" />
          {/* aria-pressed carries the state; the icons cross-fade in one grid cell
              so the button never changes size, and both are hidden from AT since
              the label already says what pressing will do. */}
          <button
            type="button"
            onClick={toggleTheme}
            aria-pressed={dark}
            className="icon-btn"
            aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
          >
            <FiSun aria-hidden="true" className={`col-start-1 row-start-1 size-4 transition-opacity ${dark ? "opacity-100" : "opacity-0"}`} />
            <FiMoon aria-hidden="true" className={`col-start-1 row-start-1 size-4 transition-opacity ${dark ? "opacity-0" : "opacity-100"}`} />
          </button>
        </nav>
      </div>
    </header>
  );
}
