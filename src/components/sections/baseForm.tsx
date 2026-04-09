"use client";

import { BaseFormProps } from "@/lib/base/types/inputTypes";

export default function BaseForm(props: BaseFormProps) {
    return (
        <div className="app-panel">
            <form
                className={props.className ?? "card h-full"}
                onSubmit={(e) => {
                    e.preventDefault();
                    props.onSubmit();
                }}
            >
                {/* Main content grows */}
                <div className="card-body">
                    {props.noPanel ? props.children : (
                        <div className="bg-base-200 rounded-box p-6 border border-base-300">
                            {props.children}
                        </div>
                    )}
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
