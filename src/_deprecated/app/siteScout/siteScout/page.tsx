import InstructionPanel from "@/components/sections/instructionPanel";
import SiteScoutForm from "@/app/siteScout/form";
import Link from "next/link";

// Steps for the SiteScout instructions panel
const steps = [
    { icon: "🎣", text: <p>Import your <strong>ShopReel</strong> results file.</p> },
    { icon: "📂", text: <p>Import your <strong>FishTales</strong> starter file, or use the <Link href="/fishTales_starter_file.xlsx" className="link-external"><strong>example file</strong></Link>.</p> },
    { icon: "✅", text: <p>Click <strong>Compare</strong> to start.</p> },
];

/**
 * SiteScout Page Component
 *
 * Renders the instructions panel and the SiteScout form.
 */
export default function SiteScout() {
    return (
        <main className="app-container">
            <div className="app-content">
                {/* Instructions panel: step-by-step guidance for using SiteScout */}
                <InstructionPanel
                    app="SiteScout"
                    description={
                        <p>
                            SiteScout keeps your <strong>FishTales</strong> starter file up to date
                            by checking it against your <strong>ShopReel</strong> results. Any new report sites are
                            added automatically, so your dataset stays accurate and complete.
                        </p>
                    }
                    steps={steps}
                />

                {/* Form panel for submitting SiteScout files */}
                <SiteScoutForm />
            </div>
        </main>
    );
}
