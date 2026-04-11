import React from "react";

export interface InputWrapperProps {
    type: "text" | "textarea" | "password" | "number" | "checkbox";
    id: string;
    label: string;
    error?: string;
    children: React.ReactNode;
}

export interface InputGroupWrapperProps {
    label: string;
    children: React.ReactNode;
    errors?: (string | undefined)[];
}

export interface BaseInputProps {
    label: string;
    tooltip?: string;
    error?: string;
    noWrapper?: boolean;
    isRequired?: boolean;
}

export interface TextProps extends BaseInputProps {
    type: "text" | "password" | "number";
    step?: string;
    value: string | number;
    placeholder: string;
    onChange: (value: string) => void;
}

export interface TextAreaProps extends BaseInputProps {
    rows: number;
    value: string;
    placeholder?: string;
    onChange: (value: string) => void;
}

export interface CheckedBoxProps extends BaseInputProps {
    checked: boolean;
    onChange: (value: boolean) => void;
}

export interface MapProps {
    show: boolean;
    onClose: () => void;
    latitude: number;
    longitude: number;
    onChange: (lat: number, lng: number) => void;
}

export interface FileProps {
    className?: string;
    label: string;
    fileName: string | null;
    onSelect: (file: File | null) => void;
}

export interface BaseFormProps {
    onSubmit: () => void;
    buttonText: string;
    errors?: (string | undefined)[];
    children: React.ReactNode;
    className?: string;
    noPanel?: boolean;
}