import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type React from "react";
import { FiArrowRight } from "react-icons/fi";
import { idea, important, serve } from "@/client/images/about";

export const metadata: Metadata = {
  title: "About — Flybox",
  description: "Learn about Flybox, the fly-fishing data aggregation tool built for Rescue River.",
};

const RescueRiver = () => (
  <a className="link link-primary" href="https://rescueriver.com/" target="_blank" rel="noopener noreferrer">
    Rescue River
  </a>
);

function Feature({
  index,
  heading,
  children,
  img,
  alt,
  reverse = false,
}: {
  index: string;
  heading: string;
  children: React.ReactNode;
  img: Parameters<typeof Image>[0]["src"];
  alt: string;
  reverse?: boolean;
}) {
  return (
    <section className={`flex flex-col items-center gap-8 py-12 ${reverse ? "md:flex-row-reverse" : "md:flex-row"}`}>
      <div className="w-full">
        {/* The line art is drawn in dark ink, so it sits on a fixed paper plate in
            BOTH themes. The old in-data-[theme=dark]:invert mix-blend-screen hack
            mangled the artwork instead of framing it. */}
        <div className="rounded-field border border-rule bg-[oklch(97.5%_0.008_92)] p-4">
          <Image src={img} alt={alt} className="h-auto max-w-full" />
        </div>
        <a
          href="https://www.freepik.com"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1.5 block text-center text-xs text-base-content/70 no-underline hover:text-base-content"
        >
          Designed by Dooder / Freepik
        </a>
      </div>
      <div className="w-full">
        <span className="eyebrow">{index}</span>
        <h3 className="mt-1.5">{heading}</h3>
        <div className="mt-3 max-w-[62ch] space-y-3">{children}</div>
      </div>
    </section>
  );
}

const links = [
  {
    index: "01",
    title: "Flybox",
    description: "Finds local fly-fishing shops, identifies which ones publish fishing reports, and summarizes them with Google Gemini.",
    href: "/docs?tab=Flybox",
  },
  {
    index: "02",
    title: "SerpAPI",
    description: "Powers the Google Maps search that finds fly-fishing shops near your chosen position.",
    href: "/docs?tab=SerpAPI",
  },
  {
    index: "03",
    title: "Gemini API",
    description: "Reads and summarizes fishing reports from shop websites into a structured, easy-to-read format.",
    href: "/docs?tab=Gemini API",
  },
];

export default function About() {
  return (
    <div className="shell py-12">
      <section>
        <span className="eyebrow">About</span>
        <h1 className="mt-2 max-w-[52ch]">Helping you stay informed and ready for your next fly-fishing adventure.</h1>
        <hr className="mt-8 mb-0" />
      </section>

      <Feature index="01" img={idea} alt="Illustration of a person with an idea" heading="Where the idea came from">
        <p>
          Flybox started as an idea by one of <RescueRiver />
          &apos;s founders, both to help with marketing — so they could know which flies to make, what colors to use, and where to promote certain flies — and
          as a tool for fly-fishing enthusiasts.
        </p>
      </Feature>

      <Feature index="02" img={important} alt="Illustration of a person with a megaphone" heading="Why it matters" reverse>
        <p>Fly-fishing information is often scattered, incomplete, or outdated. Flybox consolidates up-to-date information, helping users:</p>
        <ul>
          <li>Locate shops quickly and accurately.</li>
          <li>Access AI-powered summaries of the latest fishing activity.</li>
          <li>Plan trips with confidence and spend more time fishing.</li>
        </ul>
      </Feature>

      <Feature index="03" img={serve} alt="Illustration of two people in conversation" heading="Who we serve">
        <p>
          First and foremost, Flybox supports <RescueRiver />
          &apos;s mission to bring hope and healing to survivors of trafficking and exploitation. By organizing fly-fishing data, we help them choose which
          flies to produce, which colors to prioritize, and where to promote them — while giving fly-fishing enthusiasts a single place to stay informed and
          engaged.
        </p>
      </Feature>

      <section className="mt-4 border-t border-rule pt-8">
        <span className="eyebrow">Learn how it works</span>
        <ul className="ms-0 mt-3 list-none divide-y divide-rule">
          {links.map(({ index, title, description, href }) => (
            <li key={title}>
              <Link href={href} className="group flex items-baseline gap-4 py-4">
                <span className="readout text-micro text-mark">{index}</span>
                <span className="flex-1">
                  <span className="block font-semibold">{title}</span>
                  <span className="block text-sm text-base-content/70">{description}</span>
                </span>
                <span className="flex shrink-0 items-center gap-1.5 text-sm text-primary">
                  Read more
                  <FiArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
