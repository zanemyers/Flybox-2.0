import {type ExternalLinkProps} from "@/lib/base/types/componentTypes";

/**
 * ExternalLink Component
 * Handles normal external links opening in a new tab with proper security attributes.
 */
export default function ExternalLink(props: ExternalLinkProps) {
    return (
        <a
            className="link-external"
            href={props.target}
            target="_blank"
            rel="noopener noreferrer">
            {props.children}
        </a>
    );
}