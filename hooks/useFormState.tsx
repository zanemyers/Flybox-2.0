import {useState} from "react";

export function useFormState<T extends object>(initial: T) {
    const [form, setForm] = useState<T>(initial);

    // update the state of the form for a given key
    const update = <K extends keyof T>(key: K, value: T[K]) => {
        setForm((prev) => ({ ...prev, [key]: value }));
    };

    // reset the state to its original form
    const reset = () => setForm(initial);

    return { form, update, setForm, reset };
}
