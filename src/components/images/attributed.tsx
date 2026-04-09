import Image from "next/image";
import { type AttributedImageProps} from "@/lib/base/types/componentTypes";

export default function AttributedImage(props: AttributedImageProps) {
    return (
        <>
            {/* Main image */}
            <Image src={props.img} alt={props.alt} className="max-w-full h-auto"/>

            {/* Attribution */}
            {props.attribution && props.url && (
                <p className="text-sm text-center mt-1">
                    <a
                        href={props.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-base-content/30 hover:text-base-content/50 no-underline"
                    >
                        {props.attribution}
                    </a>
                </p>
            )}
        </>
    );
}

