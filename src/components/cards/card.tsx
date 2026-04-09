import Link from "next/link";
import type { CardProps } from "@/lib/base/types/componentTypes"

export default function Card(props: CardProps) {
    return (
        <div className="w-full md:w-[49.5%] mb-4 text-center">
            <div className="card-light">
                <div className="card-body">
                    {/* Icon */}
                    <div className="mb-4 text-6xl">
                        {props.icon}
                    </div>

                    {/* Title */}
                    <h4>{props.title}</h4>

                    {/* Description */}
                    <p className="mb-4 text-lg text-base-content/80">
                        {props.description}
                    </p>

                    {/* Button */}
                    <div className="flex justify-center">
                        <Link href={props.link} className="primary-button ">
                            {props.buttonText}
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
