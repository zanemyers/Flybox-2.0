import type { ListBlockProps } from "@/lib/base/types/componentTypes";
import CenteredImage from "@/components/images/centered";

/**
 * ListBlock component
 *
 * Renders a customizable list with optional labels, notes, images, and nested items.
 * - Supports nested lists recursively.
 */
export default function ListBlock(props: ListBlockProps) {
    const ListTag = props.ordered ? "ol" : "ul"; // Decide tag based on ordered prop

    return (
        <ListTag className={props.extraClass}>
            {props.items.map((item, index) => (
                <li key={`item-${index}`}>
                    {/* Render the label in bold if it exists, followed by colon if main exists */}
                    <div className="flex flex-row flex-wrap">
                        {item.label && (
                            <strong className={item.main ? "mr-1" : ""}>
                                {item.label}
                                {item.main && ":"}
                            </strong>
                        )}

                        {item.main && <>{item.main}</>}
                    </div>

                    {/* Render note if it exists */}
                    {item.note && (
                        <div className="flex flex-row flex-wrap">
                            {item.noteLabel && <em className="mr-1.5">{item.noteLabel}:</em>}
                            {item.note && <>{item.note}</>}
                        </div>
                    )}

                    {/* Recursively render children if nested items exist */}
                    {item.children && <ListBlock items={item.children} ordered={props.orderChild} />}

                    {/* Render image if provided */}
                    {item.img && item.alt && (
                        <>
                            <CenteredImage img={item.img} alt={item.alt} />
                        </>
                    )}
                </li>
            ))}
        </ListTag>
    );
}
