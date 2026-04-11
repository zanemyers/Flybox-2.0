import { NavLinkProps } from "@/server/types/componentTypes";
import Link from "next/link";

/** NavLink Component - Handles navbar navigation links. */
export default function NavLink(props: NavLinkProps) {
    return (
        <li key={props.label}>
            <Link
                href={props.href}
                className={`font-medium transition-colors hover:text-primary ${
                    props.active
                        ? "text-primary underline underline-offset-4 decoration-2"
                        : ""
                }`}
            >
                {props.label}
            </Link>
        </li>
    );
}
