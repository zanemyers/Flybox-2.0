"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { FaMoon, FaSun } from "react-icons/fa";
import tackleBox from "@/client/images/tackle_box.png";

const navLinks = [
  { label: "Home", href: "/" },
  { label: "Docs", href: "/docs" },
  { label: "About", href: "/about" },
];

function applyTheme(isDark: boolean) {
  const theme = isDark ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", theme);
  document.documentElement.style.colorScheme = theme;
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
    <header className="w-full pt-6 bg-base-100 relative">
      <Link href="/" className="flex items-center justify-center gap-3 mb-4">
        <Image src={tackleBox} alt="Tackle Box" width={64} height={64} />
        <h1 className="text-6xl text-primary font-light">Flybox</h1>
      </Link>
      <button
        type="button"
        onClick={toggleTheme}
        className="btn btn-ghost btn-sm btn-circle absolute top-4 right-4"
        aria-label="Toggle theme"
      >
        {dark ? <FaSun className="w-4 h-4" /> : <FaMoon className="w-4 h-4" />}
      </button>
      <nav className="w-[95%] bg-base-200 shadow mx-auto py-2 px-6">
        <ul className="flex flex-wrap justify-center gap-5 items-center list-none">
          {navLinks.map(({ label, href }) => (
            <li key={label}>
              <Link
                href={href}
                className={`font-medium transition-colors hover:text-primary ${currentPath === href ? "text-primary underline underline-offset-4 decoration-2" : ""}`}
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
