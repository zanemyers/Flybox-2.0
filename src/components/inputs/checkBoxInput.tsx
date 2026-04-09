import {CheckedBoxProps} from "@/lib/base/types/inputTypes";
import InputWrapper from "@/components/inputs/wrappers/InputWrapper";

export default function CheckBoxInput(props: CheckedBoxProps) {
    const id = props.label.toLowerCase().replace(/\s+/g, "-");

    const inputEl = (
        <input
            id={id}
            type="checkbox"
            className="form-check-input"
            title={props.tooltip}
            checked={props.checked}
            onChange={(e) => props.onChange(e.target.checked)}
        />
    );

    if (props.noWrapper) return inputEl;
    return (
        <InputWrapper type="checkbox" id={id} label={props.label} error={props.error}>
            {inputEl}
        </InputWrapper>
    );
}