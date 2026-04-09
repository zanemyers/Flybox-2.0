import type { DocSectionProps } from "@/lib/base/types/componentTypes";

/**
 * Represents a section of documentation with optional overview and conclusion.
 * Can be rendered as a subsection with smaller header tags.
 */
export default function DocSection(props: DocSectionProps) {
    const id = props.title.toLowerCase().replaceAll(" ", "-"); // Generate HTML id for anchor links
    const HeaderTag = props.subSection ? "h5" : "h3"; // Smaller header if subsection

    return (
        <section id={id} className="pb-6">
            {/* Section header */}
            <HeaderTag className={props.subSection ? '' : 'py-2'}>{props.title}</HeaderTag>

            {/* Optional overview rendered with Markdown */}
            {props.overview && (
                <div className={props.subSection ? 'pb-1' : 'pb-6'}>
                   {props.overview}
                </div>
            )}

            {/* Main section content */}
            {props.children}

            {/* Optional conclusion rendered with Markdown */}
            {props.conclusion && <>{props.conclusion}</>}
        </section>
    );
}