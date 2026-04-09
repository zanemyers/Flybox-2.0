import { TextAreaProps } from "@/lib/base/types/inputTypes";

export default function TextAreaInput(props: TextAreaProps) {
    const id = props.label.toLowerCase().replace(/\s+/g, "-");

    return (
        <div className="w-full">
            <label htmlFor={id} className="input-label">{props.label}</label>
            <textarea
                id={id}
                className="textarea textarea-bordered w-full"
                placeholder={props.placeholder}
                title={props.tooltip}
                rows={props.rows}
                value={props.value}
                onChange={(e) => props.onChange(e.target.value)}
            />
            {props.error && <p className="text-error text-sm mt-1">{props.error}</p>}
        </div>
    );
}
