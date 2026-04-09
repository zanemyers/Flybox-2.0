import { idea, important, serve } from "./images/images"
import AboutSection from "@/components/sections/about";
import ExternalLink from "@/components/links/external";
import Card from "@/components/cards/card"

/**
 * About Page Component
 *
 * Displays information about Flybox, including its origin, importance,
 * who it serves, and the main tools/features it offers.
 */
export default function About() {
    return (
        <div className="container text-primary w-[85%] mx-auto">
            <section className="text-center pt-12">
                <h2>
                    Helping you stay informed and ready for your next fly-fishing adventure.
                </h2>
            </section>

            {/* AboutSection: Explains the origin of Flybox */}
            <AboutSection
                img={idea}
                alt="Idea Illustration"
                url="https://www.freepik.com"
                attribution="Designed by Dooder / Freepik"
                heading="Where the Idea Came From"
            >
                <p>
                    Flybox started as an idea by one of <ExternalLink target="https://rescueriver.com/">Rescue River</ExternalLink>
                    's founders, both to help with marketing—so they could know which flies to make, what
                    colors to use, and where to promote certain flies—and as a tool for fly-fishing
                    enthusiasts.
                </p>
            </AboutSection>

            {/* AboutSection: Highlights why Flybox matters */}
            <AboutSection
                img={important}
                alt="Important Illustration"
                url="https://www.freepik.com"
                attribution="Designed by Dooder / Freepik"
                heading="Why It Matters"
                reverse={true}
            >
                <p>
                    Fly-fishing information is often scattered, incomplete, or outdated. Flybox consolidates
                    up-to-date information, helping users:
                </p>
                <ul>
                    <li>Locate shops quickly and accurately.</li>
                    <li>Access AI-powered summaries of the latest fishing activity.</li>
                    <li>Plan trips with confidence and spend more time fishing.</li>
                </ul>
            </AboutSection>

            {/* AboutSection: Who Flybox serves */}
            <AboutSection
                img={serve}
                alt="Serve Illustration"
                url="https://www.freepik.com"
                attribution="Designed by Dooder / Freepik"
                heading="Who We Serve"
            >
                <p>
                    First and foremost, Flybox supports{" "}
                    <ExternalLink target="https://rescueriver.com/">
                        Rescue River
                    </ExternalLink>
                    ’s mission to bring hope and healing to survivors of trafficking and exploitation. By
                    organizing fly-fishing data, we help them choose which flies to produce, which colors to
                    prioritize, and where to promote them—while giving fly-fishing enthusiasts a single place
                    to stay informed and engaged.
                </p>
            </AboutSection>

            {/* Overview / Features: Main Flybox tools displayed in cards */}
            <section className="mb-12 py-12">
                <h2 className="mb-10 text-center">
                    What Flybox Offers
                </h2>

                <div className="flex flex-wrap justify-between">
                {/* ShopReel: Scrapes business data from Google Maps and websites */}
                    <Card
                        icon="🎣"
                        title="ShopReel"
                        description="ShopReel scrapes business data from Google Maps and shop websites, compiling key details into a structured Excel file."
                        link="/docs?tab=ShopReel"
                        buttonText="Read More"
                    />

                    {/* FishTales: Consolidates fishing reports into AI-generated summaries */}
                    <Card
                        icon="🐟"
                        title="FishTales"
                        description="FishTales parses and consolidates fishing reports from multiple websites into structured, AI-generated summaries."
                        link="/docs?tab=FishTales"
                        buttonText="Read More"
                    />

                    {/* SiteScout: Compares ShopReel and FishTales data to find new spots */}
                    <Card
                        icon="🗺"
                        title="SiteScout"
                        description="SiteScout compares the ShopReel and FishTales files to find new fishing spots."
                        link="/docs?tab=SiteScout"
                        buttonText="Read More"
                    />
                </div>
            </section>

        </div>
    );
}