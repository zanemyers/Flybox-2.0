import { CheckedBoxProps } from "@/lib/base/types/inputTypes";

export default function CheckBoxInput(props: CheckedBoxProps) {
    const id = props.label.toLowerCase().replace(/\s+/g, "-");

    return (
        <div className="flex items-center gap-2">
            <input
                id={id}
                type="checkbox"
                className="checkbox bg-base-100"
                title={props.tooltip}
                checked={props.checked}
                onChange={(e) => props.onChange(e.target.checked)}
            />
            <label htmlFor={id} className="input-label mb-0 cursor-pointer">
                {props.label}
            </label>
        </div>
    );
}
