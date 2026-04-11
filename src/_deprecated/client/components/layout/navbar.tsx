"use client";

import { usePathname } from "next/navigation";
import type { NavLinkProps } from "@/server/types/componentTypes";
import { NavLink } from "@/client/components/links";

const links: NavLinkProps[] = [
    { label: "Home", href: "/" },
    { label: "Docs", href: "/docs" },
    { label: "About", href: "/about" },
];

export default function NavigationBar() {
    const currentPath = usePathname();

    return (
        <nav className="w-[95%] bg-base-200 shadow mx-auto py-2 px-6">
            <ul className="flex flex-wrap justify-center gap-5 items-center list-none">
                {links.map((link: NavLinkProps) => (
                    <NavLink key={link.label} label={link.label} href={link.href} active={currentPath === link.href} />
                ))}
            </ul>
        </nav>
    );
}