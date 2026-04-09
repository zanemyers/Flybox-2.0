import React from "react";
import type { AboutSectionProps } from "@/lib/base/types/componentTypes";
import AttributedImage from "@/components/images/attributed";

/**
 * AboutSection component
 *
 * Displays an image and content side-by-side.
 * Image stacks above content on mobile.
 * Supports reversing order on desktop.
 */
export default function AboutSection({heading, children, reverse = false, ...AttributedImageProps}: AboutSectionProps) {
    return (
        <section
            className={`flex flex-col items-center py-8 ${reverse ? "md:flex-row-reverse" : " md:flex-row"}`}
        >
            {/* Image */}
            <div className="w-full mb-3">
                <AttributedImage {...AttributedImageProps} />
            </div>

            {/* Content */}
            <div className="w-full">
                <h2 className="text-2xl mb-3">
                    {heading}
                </h2>
                <div>
                    {children}
                </div>
            </div>
        </section>
    );
}