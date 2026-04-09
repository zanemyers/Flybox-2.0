import { useState } from "react";
import {Button, DropZone, FileTrigger} from "react-aria-components";
import { type FileProps} from "@/lib/base/types/inputTypes";
import {X, Upload} from "lucide-react";


export default function FileInput(props: FileProps) {
    const ExcelTypes = ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.ms-excel"];
    const [isDragging, setIsDragging] = useState(false);

    return (
        <div className={props.className}>
            <p className="input-label">{props.label}</p>
            <DropZone
                className={`card-light min-h-30 ${isDragging ? "bg-base-300" : ""}`}
                getDropOperation={(types) =>
                    ExcelTypes.some(t => types.has(t)) ? "copy" : "cancel"
                }
                onDrop={async (event) => {
                    setIsDragging(false);
                    const fileItem = event.items.find((i) => i.kind === "file" && ExcelTypes.includes(i.type));
                    if (!fileItem || fileItem.kind !== "file") return;
                    props.onSelect(await fileItem.getFile());
                }}
                onDropEnter={() => setIsDragging(true)}
                onDropExit={() => setIsDragging(false)}
            >
                {!props.fileName ? (
                    <FileTrigger
                        acceptedFileTypes={[".xlsx", ".xls"]}
                        onSelect={(e) => props.onSelect(e?.[0] ?? null)}
                    >
                        <Button className="flex-1 w-full items-center justify-center cursor-pointer">
                            <div className="flex flex-col items-center justify-center">
                                <Upload className="w-8 h-8 mb-3" />
                                Click or drag an XLSX file here
                            </div>
                        </Button>
                    </FileTrigger>
                ) : (
                    <div className="flex flex-row w-full h-full justify-center items-center">
                        <Button
                            onPress={() => props.onSelect(null)}
                            className="btn btn-error btn-sm me-2"
                            aria-label="Remove file"
                        >
                            <X className="w-4 h-4" />
                        </Button>
                        {props.fileName}
                    </div>
                )}
            </DropZone>
        </div>
    );
}
