import Image from "next/image";
import {type ImageProps} from "@/lib/base/types/componentTypes"

export default function CenteredImage(props: ImageProps) {
    return (
        <div className="flex justify-center pb-4">
            <Image src={props.img} alt={props.alt} />
        </div>
    );
}
