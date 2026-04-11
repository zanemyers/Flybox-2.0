import InstructionPanel from "@/components/sections/instructionPanel";
import ShopReelForm from "@/app/shopReel/form";

// Steps for the ShopReel instructions panel
const steps = [
    { icon: "🔐", text: <p>Enter your <strong>SerpAPI key</strong></p> },
    { icon: "🔎", text: <p>Enter a <strong>search term</strong></p> },
    { icon: "📍", text: <p>Pick a location or enter <strong>latitude</strong> and <strong>longitude</strong></p> },
    { icon: "🔢", text: <p>Set the <strong>maximum number of results</strong></p> },
    { icon: "✅", text: <p>Click <strong>Search</strong> to start</p> },
];

/**
 * ShopReel Page Component
 *
 * Renders the instructions panel and the ShopReel form.
 */
export default function ShopReel() {
    const serpApiKey = process.env.SERP_API_KEY ?? "";

    return (
        <main className="app-container">
            <div className="app-content">
                <InstructionPanel
                    app="ShopReel"
                    description={
                        <p>
                            ShopReel helps you find businesses near a location using <strong>SerpAPI</strong> and <strong>Google Maps</strong>,
                             and puts the information into an easy-to-read Excel file.
                        </p>
                    }
                    steps={steps}
                    defaultsDescription={
                        <p>
                            By default, ShopReel searches for <strong>Fly Fishing Shops</strong> near <strong>Yellowstone National Park</strong> and
                             shows the first <strong>100</strong> results. You can change these settings to search any location or business type.
                        </p>
                    }
                />

                <ShopReelForm defaultApiKey={serpApiKey} />
            </div>
        </main>
    );
}
