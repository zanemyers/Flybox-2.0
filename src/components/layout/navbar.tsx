"use client";

import { usePathname } from "next/navigation";
import type { NavLinkProps } from "@/lib/base/types/componentTypes";
import NavLink from "@/components/links/nav";
import ThemeToggle from "@/components/layout/themeToggle";
import { ChevronDownIcon } from "@heroicons/react/24/solid";

const links: NavLinkProps[] = [
    { label: "Home", href: "/" },
    { label: "ShopReel", href: "/shopReel" },
    { label: "FishTales", href: "/fishTales" },
];

const dropDownLinks: NavLinkProps[] = [
    { label: "SiteScout", href: "/siteScout"},
    { label: "Docs", href: "/docs" },
]

export default function NavigationBar() {
    const currentPath = usePathname();

    return (
        <nav className="w-[95%] bg-base-200 shadow rounded mx-auto py-2">
            <ul className="flex flex-wrap justify-center gap-5 items-center list-none">

                {/* Main links */}
                {links.map((link: NavLinkProps) => (
                    <NavLink key={link.label} label={link.label} href={link.href} active={currentPath === link.href} />
                ))}

                {/* Dropdown links */}
                {dropDownLinks.length > 0 && (
                    <li className="dropdown dropdown-hover">
                        <label className="flex items-center font-medium cursor-pointer">
                            More <ChevronDownIcon className="ms-1 w-4 h-4" />
                        </label>
                        <ul className="dropdown-content menu p-2 shadow bg-base-100 rounded-box w-40">
                            {dropDownLinks.map((link: NavLinkProps) => (
                                <NavLink key={link.label} label={link.label} href={link.href} active={currentPath === link.href} />
                            ))}
                        </ul>
                    </li>
                )}

                {/* About links - always last */}
                <NavLink label="About" href="/about" active={currentPath === "/about"} />

                <li><ThemeToggle /></li>
            </ul>
        </nav>
    );
}
