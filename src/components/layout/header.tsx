import Image from "next/image";
import Link from "next/link";
import NavigationBar from "@/components/layout/navbar"; // your nav component
import tackleBox from "@/app/tackle_box.png"

/**
 * Header component
 *
 * Renders the top section of the site including the logo, title, and navigation bar.
 * Uses Tailwind and daisyUI for styling.
 */
export default function Header() {
    return (
        <header className="w-full pt-6 bg-base-100">
            {/* Logo and site title */}
            <Link href="/" className="flex items-center justify-center mb-4 sm:flex-row sm:gap-3">
                <Image
                    src={tackleBox}
                    alt="Tackle Box"
                    width={64}
                    height={64}
                />
                <h1 className="text-6xl text-primary font-light">Flybox</h1>
            </Link>

            {/* Navigation bar */}
            <NavigationBar />
        </header>
    );
}