import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { FiArrowRight, FiExternalLink } from "react-icons/fi";
import { idea, important, serve } from "@/client/images/about";

export const metadata: Metadata = {
  title: "About — Flybox",
  description: "Learn about Flybox, the fly-fishing data aggregation tool built for Rescue River.",
};

const RescueRiver = () => (
  <a className="link link-primary" href="https://rescueriver.com/">
    Rescue River
  </a>
);

function Feature({
  index,
  heading,
  children,
  img,
  reverse = false,
  priority = false,
}: {
  index: string;
  heading: string;
  children: ReactNode;
  img: Parameters<typeof Image>[0]["src"];
  reverse?: boolean;
  priority?: boolean;
}) {
  return (
    <div className={`flex flex-col items-center gap-8 py-12 ${reverse ? "md:flex-row-reverse" : "md:flex-row"}`}>
      <div className="w-full max-w-sm md:w-2/5 md:max-w-none">
        {/* bg-white, not a theme token — it matches the JPEGs' own background, so object-contain leaves no seam. */}
        <div className="rounded-field border border-rule bg-white p-4 in-data-[theme=dark]:opacity-50">
          <Image
            src={img}
            alt=""
            priority={priority}
            sizes="(min-width: 1152px) 400px, (min-width: 768px) 40vw, 350px"
            className="aspect-4/3 w-full object-contain"
          />
        </div>
      </div>
      <div className="w-full md:w-3/5">
        <span aria-hidden="true" className="readout text-micro text-mark">
          {index}
        </span>
        <h2 className="mt-1.5 text-xl">{heading}</h2>
        <div className="prose-measure mt-3 space-y-3">{children}</div>
      </div>
    </div>
  );
}

const links = [
  {
    index: "01",
    title: "How it works",
    description: "The five stages a run goes through, from the Maps search to the finished report — and the numbers behind each one.",
    href: "/how-it-works",
  },
  {
    index: "02",
    title: "Rescue River",
    description: "The organization Flybox was built for, bringing hope and healing to survivors of trafficking and exploitation.",
    href: "https://rescueriver.com/pages/about",
  },
];

export default function About() {
  return (
    <div className="shell py-12">
      <div>
        <h1 className="max-w-[52ch]">Helping you stay informed and ready for your next fly-fishing adventure.</h1>
        <hr className="mt-8 mb-0" />
      </div>

      <Feature index="01" img={idea} heading="Where the idea came from" priority>
        <p>
          Flybox started as an idea by one of <RescueRiver />
          &apos;s founders, both to help with marketing — so they could know which flies to make, what colors to use, and where to promote certain flies — and
          as a tool for fly-fishing enthusiasts.
        </p>
      </Feature>

      <Feature index="02" img={important} heading="Why it matters" reverse priority>
        <p>Fly-fishing information is often scattered, incomplete, or outdated. Flybox consolidates up-to-date information, helping users:</p>
        <ul>
          <li>Locate shops quickly and accurately.</li>
          <li>Access AI-powered summaries of the latest fishing activity.</li>
          <li>Plan trips with confidence and spend more time fishing.</li>
        </ul>
      </Feature>

      <Feature index="03" img={serve} heading="Who we serve">
        <p>
          First and foremost, Flybox supports <RescueRiver />
          &apos;s mission to bring hope and healing to survivors of trafficking and exploitation. By organizing fly-fishing data, we help them choose which
          flies to produce, which colors to prioritize, and where to promote them — while giving fly-fishing enthusiasts a single place to stay informed and
          engaged.
        </p>
      </Feature>

      {/* Magnific's free license requires this attribution, worded and linked as they specify. */}
      <p className="text-xs text-base-content/70">
        Illustrations designed by{" "}
        <a className="underline underline-offset-2 hover:text-base-content" href="https://www.magnific.com">
          Magnific
        </a>
        .
      </p>

      <div className="mt-8 border-t border-rule pt-8">
        <h2 className="eyebrow">Read next</h2>
        <ul role="list" className="ms-0 mt-3 list-none divide-y divide-rule">
          {links.map(({ index, title, description, href }) => {
            const external = href.startsWith("http");
            return (
              <li key={title}>
                <Link href={href} className="group flex items-baseline gap-4 py-4">
                  <span aria-hidden="true" className="readout text-micro text-mark">
                    {index}
                  </span>
                  <span className="flex-1">
                    <span className="block font-semibold">{title}</span>
                    <span className="block text-sm text-base-content/70">{description}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5 text-sm text-primary">
                    Read more
                    {external ? (
                      <>
                        <span className="sr-only">(external site)</span>
                        <FiExternalLink className="size-3.5" />
                      </>
                    ) : (
                      <FiArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
