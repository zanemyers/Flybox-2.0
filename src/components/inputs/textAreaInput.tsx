import { TextAreaProps } from "@/lib/base/types/inputTypes";
import InputWrapper from "@/components/inputs/wrappers/InputWrapper";

export default function TextAreaInput(props: TextAreaProps) {
    const id = props.label.toLowerCase().replace(/\s+/g, "-");

    const inputEl = (
        <textarea
            className="form-control"
            id={id}
            placeholder={props.placeholder}
            title={props.tooltip}
            rows={props.rows}
            value={props.value}
            onChange={(e) => props.onChange(e.target.value)}
        />
    );

    if (props.noWrapper) return inputEl;
    return (
        <InputWrapper type="textarea" id={id} label={props.label} error={props.error}>
            {inputEl}
        </InputWrapper>
    );
}