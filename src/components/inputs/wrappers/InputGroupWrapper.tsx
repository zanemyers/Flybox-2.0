import {InputGroupWrapperProps} from "@/lib/base/types/inputTypes";


/**
 * FormInputGroup Component
 * Wraps multiple inputs with a shared label and displays multiple errors
 */
export default function InputGroupWrapper(props: InputGroupWrapperProps) {
    return (
        <div className="form-input">
            <label className="form-label">{props.label}</label>
            <div className="input-group">{props.children}</div>
            {/* Render all errors below the group */}
            {props.errors?.map((error, i) => (
                <div key={`error-${i}`} className="form-error">
                    {error}
                </div>
            ))}
        </div>
    );
}