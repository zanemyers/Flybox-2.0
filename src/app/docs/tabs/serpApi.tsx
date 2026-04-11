import { serpDash, serpHome, serpSub } from "@/client/images/docs";
import { DocSection, ListBlock } from "@/client/components/docs";

const serpListItems = [
    {
        main: <p>Go to <a className="link-external" href="https://serpapi.com/" target="_blank" rel="noopener noreferrer">SerpApi</a> and create an account</p>,
        img: serpHome,
        alt: "SerpAPI App",
    },
    {
        main: "Verify your email and phone number to set up a free account.",
        img: serpSub,
        alt: "SerpAPI Subscription",
    },
    {
        main: <p>Your API key is automatically generated. Copy the section called <code>Your Private API Key</code> to use in ShopReel.</p>,
        img: serpDash,
        alt: "Your Private API Key",
    },
];

export default function SerpApiDoc() {
    return (
        <>
            <h1 className="text-4xl font-semibold pb-3">🔑 SerpAPI</h1>
            <p>
                SerpAPI lets Flybox search <strong>Google Maps</strong> for fly-fishing shops.
                You'll need a free API key to run Flybox.
            </p>

            <hr className="my-6" />

            <DocSection title="Get Your SerpAPI Key">
                <ListBlock items={serpListItems} ordered={true} />
            </DocSection>
        </>
    );
}
