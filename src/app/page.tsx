import Card from "@/components/cards/card"
import SlimCard from "@/components/cards/slim";

export default function Home() {
  return (
      <div className="w-[85%] mx-auto">
        {/* Hero Section: Main headline and introductory text */}
        <section className="position-relative text-center py-12 my-2">
          <div className="container position-relative text-primary">
            <h2 className="mb-2">Discover Fly Fishing Shops & Reports</h2>
            <p className="text-lg">
              Access up-to-date data and insights to enhance your fly-fishing adventures.
            </p>
          </div>
        </section>

        {/* Tools Section: Quick access cards for Flybox tools */}
        <section id="tools">
          <div className="flex flex-wrap justify-between">
            {/* ShopReel: Scraper for finding local fly-fishing shops */}
            <Card
                icon="🎣"
                title="ShopReel"
                description="Find fly-fishing shops near you!"
                link="/shopReel"
                buttonText="Cast for Details"
            />
            {/* FishTales: Aggregates latest fly-fishing reports */}
            <Card
                icon="🐟"
                title="FishTales"
                description="Get the latest fly-fishing reports for your area"
                link="/fishTales"
                buttonText="Catch the Latest"
            />
          </div>

          {/* SiteScout: Discover new fly-fishing sites */}
          <SlimCard
              icon="🗺"
              title="SiteScout"
              description="Discover new fly-fishing sites."
              link="/siteScout"
              buttonText="Check your sites"
          />
          {/* Docs: Access Flybox documentation */}
          <SlimCard
              icon="📚"
              title="Docs"
              description="Learn how to use Flybox tools."
              link="/docs"
              buttonText="Read"
          />
        </section>

        {/* Value Proposition Section: Explains Flybox benefits */}
        <section className="text-primary text-center my-2 py-12">
          <div className="container">
            <h3 className="mb-2">Connect Shops & Reports Effortlessly</h3>
            <p>
              Flybox simplifies your fly-fishing planning by combining shop locations and the latest
              reports in one place.
            </p>
          </div>
        </section>
      </div>
  );
}
