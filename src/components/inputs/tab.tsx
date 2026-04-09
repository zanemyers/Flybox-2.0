import {TabProps} from "@/lib/base/types/componentTypes"

export default function Tab(props: TabProps) {
    return (
        <>
            <input type="radio" name="my_tabs" className="tab checked:bg-base-200" aria-label={props.label} defaultChecked={props.defaultChecked} />
            <div className="tab-content bg-base-200 border-base-300 shadow-lg p-6 max-h-200 overflow-y-auto">{props.children}</div>
        </>
    );
}