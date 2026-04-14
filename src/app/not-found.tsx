import Image from "next/image";
import Link from "next/link";
import calvinFishing from "@/client/images/calvin-fishing.gif";

export default function NotFound() {
  return (
    <div className="w-[85%] text-center mx-auto py-12">
      <h1 className="mb-3 text-secondary">
        <b>404</b>
      </h1>
      <h1 className="text-primary">Gone Fishing...</h1>
      <p className="lead">Looks like the page you were trying to find has drifted downstream.</p>
      <div className="my-4 mx-auto text-center max-w-xs">
        <Image src={calvinFishing} alt="Fishing Gif" className="rounded" width={300} height={300} />
      </div>
      <Link href="/" className="btn btn-primary btn-lg px-4">
        Cast a Line Back Home
      </Link>
    </div>
  );
}
