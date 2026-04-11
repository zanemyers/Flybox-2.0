import type { DocOverviewProps } from "@/server/types/componentTypes"
import { TableOfContents } from "@/client/components/sections/docSections";

/**
 * Renders the main overview for a documentation page including a title, optional icon,
 * optional overview paragraph, and a table of contents.
 */
export default function DocOverview(props: DocOverviewProps) {
    return (
        <>
            {/* Page title with optional icon */}
            <h1 className="text-4xl font-semibold pb-3">
                {props.icon} {props.title} Documentation
            </h1>

            {/* Introductory overview paragraph */}
            {props.children}

            <hr />

            {/* Table of contents */}
            <TableOfContents items={props.tocItems} />
        </>
    );
}
