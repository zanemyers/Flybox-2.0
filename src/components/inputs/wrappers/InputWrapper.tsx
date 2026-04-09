import type { InputWrapperProps } from "@/lib/base/types/inputTypes"
import { TextField } from "react-aria-components"

export default function InputWrapper(props: InputWrapperProps) {
    const labelEl = <label htmlFor={props.id} className="">{props.label}</label>;
    return (
        <div className="form-input">
            {props.type !== "checkbox" && labelEl} {/* Label before input for non-checkbox */}
            {props.children}
            {props.type === "checkbox" && labelEl} {/* Label after input for checkbox */}
            {props.error && <div className="form-error">{props.error}</div>} {/* Error display */}
        </div>
    );
}







