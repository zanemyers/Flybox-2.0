import { NavLinkProps } from "@/lib/base/types/componentTypes";
import Link from "next/link";

/** NavLink Component - Handles navbar navigation links. */
export default function NavLink(props: NavLinkProps) {
    return (
        <li key={props.label}>
            <Link
                href={props.href}
                className={`hover:text-primary ${
                    props.active ? "text-primary font-bold" : "font-medium"
                }`}
            >
                {props.label}
            </Link>
        </li>
    );
}