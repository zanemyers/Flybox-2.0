import React from "react";

/**
 * Wrapper for individual form inputs
 * Handles label positioning and error display
 */
export interface InputWrapperProps {
    type: "text" | "textarea" | "password" | "number" | "checkbox"; // input type
    id: string; // input id
    label: string; // label text
    error?: string; // optional error message
    children: React.ReactNode; // input element(s)
}

/** Props for input group wrapper */
export interface InputGroupWrapperProps {
    label: string; // group label
    children: React.ReactNode; // input elements inside the group
    errors?: (string | undefined)[]; // array of error messages for the group
}

/** Base properties shared by all inputs */
export interface BaseInputProps {
    label: string; // label text
    tooltip?: string; // optional tooltip/title
    error?: string; // optional error message
    noWrapper?: boolean; // if true, do not wrap in FormWrapper
    isRequired?: boolean;
}

/** Props for text, password, number inputs */
export interface TextProps extends BaseInputProps {
    type: "text" | "password" | "number"; // input type
    step?: string; // step attribute for number input
    value: string | number; // current value
    placeholder: string; // input placeholder
    onChange: (value: string) => void; // change handler
}

/** Props for textarea input */
export interface TextAreaProps extends BaseInputProps {
    rows: number; // number of rows for textarea
    value: string; // current value
    placeholder?: string; // optional placeholder
    onChange: (value: string) => void; // change handler
}

/** Props for checkbox input */
export interface CheckedBoxProps extends BaseInputProps {
    checked: boolean; // current checked state
    onChange: (value: boolean) => void; // change handler
}

/** Props for MapInput component */
export interface MapProps {
    show: boolean; // whether the modal is visible
    onClose: () => void; // callback to close the modal
    latitude: number; // initial latitude
    longitude: number; // initial longitude
    onChange: (lat: number, lng: number) => void; // callback when location is selected/changed
}

/** Props for FileInput component */
export interface FileProps {
    className?: string;
    label: string; // Label to display above the input
    fileName: string | null;
    onSelect: (file: File | null) => void; // Callback to notify parent of selected file
}

export interface BaseFormProps {
    onSubmit: () => void;
    buttonText: string;
    errors?: (string | undefined)[];
    children: React.ReactNode;
}

