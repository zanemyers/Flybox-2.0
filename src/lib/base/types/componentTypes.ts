import React from "react";
import { type StaticImageData } from "next/image";

export interface ExternalLinkProps {
    target: string; // The URL or element ID to navigate to
    children: React.ReactNode; // Content inside the link
}

export interface HashLinkProps extends ExternalLinkProps {
    tab?: string; // Optional tab ID to activate before scrolling
    onActivateTab?: (tab: string) => void; // Callback to activate a tab before scrolling
}

export interface ImageProps {
    img: string | StaticImageData; // Image source URL
    alt: string;          // Alt text
}

export interface AttributedImageProps extends ImageProps {
    url: string; // Attribution URL
    attribution: string; // Attribution text
}

export interface AboutSectionProps extends AttributedImageProps {
    heading: string;
    children: React.ReactNode;
    reverse?: boolean;
}

export interface CardProps {
    icon: string; // Icon or emoji to display in the card
    title: string; // Card title
    description: string; // Card description text
    link: string; // URL for the card's button
    buttonText: string; // Text to display on the button
}

export interface NavLinkProps {
    label: string;
    href: string;
    active?: boolean;
}

/** Represents a single item in the table of contents. */
export interface TocItem {
    label: string; // The text to display for this item
    children?: TocItem[]; // Optional nested sub-items
}

export interface DocOverviewProps {
    title: string; // Main documentation title
    icon?: string; // Optional icon for visual enhancement
    children: React.ReactNode; // Typically overview paragraph or introductory content
    tocItems: TocItem[];
}

export interface DocSectionProps {
    subSection?: boolean; // If true, renders a smaller header (h5) and inline overview
    title: string; // Section title
    overview?: string; // Optional overview text (Markdown)
    conclusion?: string | React.ReactNode; // Optional conclusion text (Markdown)
    children: React.ReactNode; // Section content
}

/**
 * Interface for individual list items.
 * Supports labels, main content, notes, images, and nested children.
 */
export interface ListItems {
    label?: string; // Optional label, rendered in bold
    main?: string | React.ReactNode; // Main content, can be a string or ReactNode
    noteLabel?: string; // Optional label for the note, rendered in italics
    note?: string | React.ReactNode; // Optional note content, string or ReactNode
    img?: string | StaticImageData; // Optional image URL
    alt?: string; // Alt text for the image
    children?: ListItems[]; // Nested list items for recursive rendering
}

export interface ListBlockProps {
    items: ListItems[]; // Array of list items to render
    ordered?: boolean; // Whether the list is ordered (<ol>) or unordered (<ul>)
    orderChild?: boolean; // Whether nested children should be ordered
    extraClass?: string; // Optional extra CSS class applied to the outer <ul> or <ol>
}

export interface TabProps {
    label: string;
    children: React.ReactNode;
    defaultChecked?: boolean;
}

/** Represents a single step in the instruction panel */
export interface InstructionStep {
    icon: string; // emoji or icon for the step
    text: string | React.ReactNode; // step description (supports Markdown)
}

/** Props for InstructionPanel component */
export interface InstructionPanelProps {
    app: string; // name of the tool (used for links and headings)
    description: string | React.ReactNode; // main description of what the tool does (supports Markdown)
    steps: InstructionStep[]; // ordered steps for using the tool
    defaultsDescription?: string | React.ReactNode; // optional explanation of default settings
}
