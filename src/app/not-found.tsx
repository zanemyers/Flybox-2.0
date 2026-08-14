import Link from "next/link";
import { ContourField } from "@/client/components/brand";

export default function NotFound() {
  return (
    <div className="shell relative grid min-h-[70vh] place-content-center overflow-hidden py-12">
      <div className="pointer-events-none absolute inset-0">
        <ContourField />
      </div>
      <span aria-hidden="true" className="readout pointer-events-none absolute inset-0 grid place-content-center text-[5rem] text-base-content/12">
        404
      </span>

      <div className="relative max-w-[46ch]">
        <span className="eyebrow">Page not found</span>
        <h1 className="mt-2">Off the map</h1>
        <p className="readout mt-3 text-xs text-base-content/70">LAT --.------ LON ---.------</p>
        <p className="mt-4">Looks like the page you were trying to find has drifted downstream.</p>
        <Link href="/" className="btn btn-primary mt-6 h-10">
          Back to home
        </Link>
      </div>
    </div>
  );
}
