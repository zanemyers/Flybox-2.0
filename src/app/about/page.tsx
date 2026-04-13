import Image from "next/image";
import Link from "next/link";
import type React from "react";
import { idea, important, serve } from "../../client/images/about";

function Card({
  icon,
  title,
  description,
  link,
  buttonText,
}: {
  icon: string;
  title: string;
  description: string;
  link: string;
  buttonText: string;
}) {
  return (
    <div className="flex-1 min-w-70 text-center">
      <div className="card-light">
        <div className="card-body flex flex-col items-center">
          <div className="card-icon">{icon}</div>
          <h4>{title}</h4>
          <p className="text-lg text-base-content/80 flex-1">{description}</p>
          <Link href={link} className="primary-button mt-2">
            {buttonText}
          </Link>
        </div>
      </div>
    </div>
  );
}

const FREEPIK_ATTRIBUTION = {
  url: "https://www.freepik.com",
  attribution: "Designed by Dooder / Freepik",
};

const cards = [
  {
    icon: "🎣",
    title: "Flybox",
    description:
      "Flybox finds local fly-fishing shops, identifies which ones publish fishing reports, and summarizes them with Google Gemini.",
    link: "/docs?tab=Flybox",
  },
  {
    icon: "🔑",
    title: "SerpAPI",
    description:
      "SerpAPI powers the Google Maps search that finds fly-fishing shops near your chosen location.",
    link: "/docs?tab=SerpAPI",
  },
  {
    icon: "✨",
    title: "Gemini API",
    description:
      "Google Gemini reads and summarizes fishing reports from shop websites into a structured, easy-to-read format.",
    link: "/docs?tab=Gemini API",
  },
];

function AboutSection({
  heading,
  children,
  reverse = false,
  img,
  alt,
  attribution,
  url,
}: {
  heading: string;
  children: React.ReactNode;
  reverse?: boolean;
  img: Parameters<typeof Image>[0]["src"];
  alt: string;
  attribution?: string;
  url?: string;
}) {
  return (
    <section
      className={`flex flex-col items-center py-8 ${reverse ? "md:flex-row-reverse" : "md:flex-row"}`}
    >
      <div className="w-full mb-3 in-data-[theme=dark]:bg-base-100">
        <Image
          src={img}
          alt={alt}
          className="max-w-full h-auto in-data-[theme=dark]:invert in-data-[theme=dark]:mix-blend-screen"
        />
        {attribution && url && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-base-content/30 hover:text-base-content/50 no-underline block text-center mt-1"
          >
            {attribution}
          </a>
        )}
      </div>
      <div className="w-full">
        <h2 className="text-2xl mb-3">{heading}</h2>
        {children}
      </div>
    </section>
  );
}

export default function About() {
  return (
    <div className="container text-primary w-[85%] mx-auto">
      <section className="text-center pt-12">
        <h2>
          Helping you stay informed and ready for your next fly-fishing
          adventure.
        </h2>
      </section>

      <AboutSection
        img={idea}
        alt="Idea Illustration"
        heading="Where the Idea Came From"
        {...FREEPIK_ATTRIBUTION}
      >
        <p>
          Flybox started as an idea by one of{" "}
          <a
            className="link-external"
            href="https://rescueriver.com/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Rescue River
          </a>
          's founders, both to help with marketing—so they could know which
          flies to make, what colors to use, and where to promote certain
          flies—and as a tool for fly-fishing enthusiasts.
        </p>
      </AboutSection>

      <AboutSection
        img={important}
        alt="Important Illustration"
        heading="Why It Matters"
        reverse={true}
        {...FREEPIK_ATTRIBUTION}
      >
        <p>
          Fly-fishing information is often scattered, incomplete, or outdated.
          Flybox consolidates up-to-date information, helping users:
        </p>
        <ul>
          <li>Locate shops quickly and accurately.</li>
          <li>Access AI-powered summaries of the latest fishing activity.</li>
          <li>Plan trips with confidence and spend more time fishing.</li>
        </ul>
      </AboutSection>

      <AboutSection
        img={serve}
        alt="Serve Illustration"
        heading="Who We Serve"
        {...FREEPIK_ATTRIBUTION}
      >
        <p>
          First and foremost, Flybox supports{" "}
          <a
            className="link-external"
            href="https://rescueriver.com/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Rescue River
          </a>
          's mission to bring hope and healing to survivors of trafficking and
          exploitation. By organizing fly-fishing data, we help them choose
          which flies to produce, which colors to prioritize, and where to
          promote them—while giving fly-fishing enthusiasts a single place to
          stay informed and engaged.
        </p>
      </AboutSection>

      <section className="mb-12 py-12">
        <h2 className="mb-10 text-center">Learn How It Works</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {cards.map((card) => (
            <Card key={card.title} {...card} buttonText="Read More" />
          ))}
        </div>
      </section>
    </div>
  );
}
