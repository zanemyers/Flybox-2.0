"use client";

import { BaseFormProps } from "@/lib/base/types/inputTypes";

export default function BaseForm(props: BaseFormProps) {
    return (
        <div className="app-panel">
            <form
                className="card-base"
                onSubmit={(e) => {
                    e.preventDefault();
                    props.onSubmit();
                }}
            >
                {/* Main content grows */}
                <div className="card-body">
                    {props.children}
                </div>

                {/* Errors + button at the bottom */}
                <div className="card-body flex flex-col justify-end">
                    {props.errors && (
                        <div className="text-sm text-error">
                            <ul>
                                {props.errors.map((error) => (
                                    <li key={error}>{error}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <div>
                        <button type="submit" className="btn btn-primary w-full">
                            {props.buttonText}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
}
