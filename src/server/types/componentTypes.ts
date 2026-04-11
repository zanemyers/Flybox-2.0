import type React from "react";
import type { StaticImageData } from "next/image";

export interface TocItem {
    label: string;
    children?: TocItem[];
}

export interface DocSectionProps {
    subSection?: boolean;
    title: string;
    overview?: string;
    conclusion?: string | React.ReactNode;
    children: React.ReactNode;
}

export interface ListItems {
    label?: string;
    main?: string | React.ReactNode;
    noteLabel?: string;
    note?: string | React.ReactNode;
    img?: string | StaticImageData;
    alt?: string;
    children?: ListItems[];
}

export interface ListBlockProps {
    items: ListItems[];
    ordered?: boolean;
    orderChild?: boolean;
    extraClass?: string;
}
