import Link from "next/link";
import {CardProps} from "@/lib/base/types/componentTypes";

export default function SlimCard(props: CardProps) {
    return (
        <div className="my-3">
            <div className="card-light">
                <div className="card-body">
                    {/* Left side: Icon + Text */}
                    <div className="flex justify-between items-center">
                        <div className="flex">
                            <div className="mr-4 text-4xl">
                                {props.icon}
                            </div>

                            <div>
                                <h5 className="font-semibold">{props.title}</h5>
                                <p className="text-sm text-base-content/70">
                                    {props.description}
                                </p>
                            </div>
                        </div>


                        <div>
                            {/* Right side: Action Button */}
                            <Link href={props.link} className="secondary-button">
                                {props.buttonText}
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
