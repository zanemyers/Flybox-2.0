"use client";

import React from "react";
import { type HashLinkProps } from "@/lib/base/types/componentTypes";
import Link from "next/link";

/**
 * HashLink Component
 * Handles internal page links using an element ID (e.g., "#section-id").
 * Optionally activates a tab before scrolling to the target element.
 */
export default function HashLink(props: HashLinkProps) {
    const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
        e.preventDefault();

        const scrollToTarget = () => {
            const el = document.getElementById(props.target);
            el?.scrollIntoView({ behavior: "smooth", block: "start" });
        };

        if (props.tab && props.onActivateTab) {
            props.onActivateTab(props.tab);

            // Delay scroll to allow tab/content to render
            setTimeout(scrollToTarget, 100);
        } else {
            scrollToTarget();
        }
    };

    return (
        <Link
            className="link-hash"
            href={`#${props.target}`}
            onClick={handleClick}
        >
            {props.children}
        </Link>
    );
}
