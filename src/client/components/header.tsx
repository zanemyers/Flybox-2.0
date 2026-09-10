"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { FiMenu, FiMoon, FiSun, FiX } from "react-icons/fi";
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
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();
  const menuRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setDark(document.documentElement.getAttribute("data-theme") === "dark");
  }, []);

  /* A plain disclosure, not role="menu": these are links, and menu semantics would promise arrow-key
     navigation this does not implement. Tab moves through them and out, which is correct here. */
  useEffect(() => {
    if (!menuOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setMenuOpen(false);
      // Escape must not strand focus on a button that just disappeared.
      toggleRef.current?.focus();
    };
    // pointerdown, not click: a click starting inside and released outside should not count as outside.
    const onPointerDown = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [menuOpen]);

  // Crossing the breakpoint while open would otherwise leave the panel rendered next to the inline row.
  useEffect(() => {
    const wide = window.matchMedia("(min-width: 40rem)");
    const close = () => setMenuOpen(false);
    wide.addEventListener("change", close);
    return () => wide.removeEventListener("change", close);
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
          {/* From sm up the links sit inline. Below it they move into the disclosure below, so the row
              never scrolls sideways and never competes with the logo for width. */}
          <ul role="list" className="hidden h-full list-none items-stretch gap-5 whitespace-nowrap sm:flex">
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
          {/* aria-pressed carries the state; the icons cross-fade in one grid cell so the button never resizes, and both are hidden from AT. */}
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

          <div ref={menuRef} className="relative sm:hidden">
            <button
              ref={toggleRef}
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              aria-controls={menuId}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              className="icon-btn"
            >
              {menuOpen ? <FiX aria-hidden="true" className="size-4" /> : <FiMenu aria-hidden="true" className="size-4" />}
            </button>

            {menuOpen && (
              <ul id={menuId} role="list" className="panel absolute right-0 top-full z-50 mt-2 w-44 list-none divide-y divide-rule py-0">
                {navLinks.map(({ label, href }) => {
                  const active = currentPath === href;
                  return (
                    <li key={label}>
                      <Link
                        href={href}
                        aria-current={active ? "page" : undefined}
                        // Closed here as well as on navigation: tapping the current page changes no route.
                        onClick={() => setMenuOpen(false)}
                        className={`eyebrow flex min-h-11 items-center px-3 transition-colors hover:text-primary ${active ? "text-primary" : ""}`}
                      >
                        {label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}
