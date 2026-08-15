import Image from "next/image";
import Link from "next/link";
import { ContourField } from "@/client/components/brand";
import calvinFishing from "@/client/images/calvin-fishing.gif";

export default function NotFound() {
  return (
    <div className="shell relative overflow-hidden py-16">
      <div className="pointer-events-none absolute inset-0">
        <ContourField />
      </div>

      <div className="relative grid items-center gap-10 md:grid-cols-2">
        <div className="max-w-[46ch]">
          <span className="eyebrow">Error 404 · Page not found</span>
          <h1 className="mt-2">Gone fishing</h1>
          <p className="readout mt-3 text-xs text-base-content/70">LAT --.------ LON ---.------</p>
          <p className="mt-4">Looks like the page you were trying to find has drifted downstream.</p>
          <Link href="/" className="btn btn-primary mt-6 h-10">
            Cast a line back home
          </Link>
        </div>

        <div className="justify-self-center md:justify-self-end">
          <div className="rounded-box border border-rule bg-[oklch(97.6%_0.011_90)] p-3">
            <Image src={calvinFishing} alt="A cartoon of someone fishing" className="h-auto w-full max-w-[18rem] rounded-field" unoptimized />
          </div>
        </div>
      </div>
    </div>
  );
}
