'use client'

import {useState} from 'react';
import { Input, Label, TextField, TooltipTrigger, Tooltip } from 'react-aria-components'
import { TextProps } from "@/lib/base/types/inputTypes";
import InputWrapper from "@/components/inputs/wrappers/InputWrapper";


// export default function TextInput(props: TextProps) {
//     const id = props.label.toLowerCase().replace(/\s+/g, "-");
//
//     const inputEl = (
//         <input
//             id={id}
//             type={props.type}
//             className="form-control"
//             placeholder={props.placeholder}
//             title={props.title}
//             step={props.type === "number" ? props.step : undefined}
//             value={props.value}
//             onChange={(e) => props.onChange(e.target.value)}
//         />
//     );
//
//     if (props.noWrapper) return inputEl;
//     return (
//         <InputWrapper type={props.type} id={id} label={props.label} error={props.error}>
//             {inputEl}
//         </InputWrapper>
//     );
// }


export default function TextInput(props: TextProps) {
    const id = props.label.toLowerCase().replace(/\s+/g, "-");

    return (
        <>
            <TextField
                id={id}
                name={props.label.toLowerCase()}
                value={String(props.value)}
                onChange={props.onChange}
            >
                <Label>{props.label}</Label>
                <TooltipTrigger>
                    <Input
                        type={props.type}
                        placeholder={props.placeholder}
                    />
                    <Tooltip>
                        {props.tooltip}
                    </Tooltip>
                </TooltipTrigger>
            </TextField>

        </>
    );
}
