import Link from 'next/link'
import Image from "next/image"
import calvinFishing from "@/app/calvin-fishing.gif";

/**
 * NotFount Component
 *
 * Displays a friendly error page for given HTTP 404 status codes.
 */
export default function NotFound() {
    return (
        <div className="w-[85%] text-center mx-auto py-12">
            {/* Large status code display (e.g., 404, 500) */}
            <h1 className="mb-3 text-secondary">
                <b>404</b>
            </h1>

            {/* Optional heading with default fallback */}
            <h1 className="text-primary">Gone Fishing...</h1>

            {/* Optional descriptive message with default fallback */}
            <p className="lead">
                Looks like the page you were trying to find has drifted downstream.
            </p>

            {/* Image/gif illustration */}
            <div className="my-4 mx-auto text-center max-w-xs">
                <Image
                    src={calvinFishing}
                    alt="Fishing Gif"
                    className="rounded"
                    width={300} // desired width in px
                    height={300} // adjust height to keep aspect ratio
                />
            </div>

            {/* Call-to-action button back to the home page */}
            <Link href="/" className="btn btn-primary btn-lg px-4">
                Cast a Line Back Home
            </Link>
        </div>
    )
}