import Link from "next/link";
import type { CardProps } from "@/lib/base/types/componentTypes"

export default function Card(props: CardProps) {
    return (
        <div className="flex-1 min-w-[280px] text-center">
            <div className="card-light">
                <div className="card-body flex flex-col items-center">
                    <div className="card-icon">{props.icon}</div>
                    <h4>{props.title}</h4>
                    <p className="text-lg text-base-content/80 flex-1">{props.description}</p>
                    <Link href={props.link} className="primary-button mt-2">
                        {props.buttonText}
                    </Link>
                </div>
            </div>
        </div>
    );
}
