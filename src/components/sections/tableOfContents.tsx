import HashLink from "@/components/links/hash"
import type { TocItem } from "@/lib/base/types/componentTypes"

/**
 * TableOfContents component
 *
 * Renders a hierarchical table of contents using nested <ul> elements.
 * Each item is a clickable link that scrolls to the corresponding section
 * (assumes section IDs are derived from labels).
 */
export default function TableOfContents({ items }: {items: TocItem[]}) {
    /**
     * Generate a DOM ID from a label string.
     * Converts to lowercase and replaces spaces with hyphens.
     */
    const generateId = (label: string) => label.toLowerCase().replace(/\s+/g, "-");

    /**
     * Recursively render TOC items and their children.
     */
    const renderItems = (items: TocItem[]) => (
        <ul>
            {items.map((item) => {
                const target = generateId(item.label); // ID to scroll to

                return (
                    <li key={target} className="underline text-primary hover:text-secondary">
                        {/* Use the HashLink variant to scroll to section */}
                        <HashLink target={target}>
                            {item.label}
                        </HashLink>

                        {/* Recursively render children if they exist */}
                        {item.children && renderItems(item.children)}
                    </li>
                );
            })}
        </ul>
    );

    return (
        <div>
            {/* Section header */}
            <h3>Contents</h3>

            {/* Render all TOC items */}
            {renderItems(items)}
        </div>
    );
}
