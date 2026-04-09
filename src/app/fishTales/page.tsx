import InstructionPanel from "@/components/sections/instructionPanel";
import FishTalesForm from "./form";
import Link from "next/link";

// Steps for the FishTales instructions panel
const steps = [
    { icon: "🔐", text: <p>Enter your <strong>Gemini API key</strong></p> },
    { icon: "️⏱️", text: <p>Set <strong>Max Report Age</strong> in days</p> },
    { icon: "🌊", text: <p>Optional: Turn on <strong>Filter by Rivers</strong> and list rivers</p> },
    { icon: "📁", text: <p>Import a <strong>Starter File</strong> or use the <Link href="/fishTales_starter_file.xlsx" className="link-external"><strong>example file</strong></Link></p> },
    { icon: "⚙️", text: <p>Optional: Adjust <strong>Advanced Settings</strong> as needed</p> },
    { icon: "✅", text: <p>Click <strong>Search & Summarize</strong> to start</p> },
];

/**
 * FishTales Page Component
 *
 * Renders the instructions panel and the FishTales form.
 */
export default function FishTales() {
    return (
        <main className="app-container">
            <div className="app-content">
                {/* Instructions panel explaining steps and defaults */}
                <InstructionPanel
                    app="FishTales"
                    description={
                        <p>
                            FishTales helps you collect and summarize fly-fishing reports from different websites. It starts with a
                            starter file to find the websites, gathers the report information, and then creates easy-to-read
                            summaries using <strong>Google's Gemini API</strong>.
                        </p>
                    }
                    steps={steps}
                    defaultsDescription={
                        <p>
                            By default, FishTales uses the <strong>gemini-2.5-flash</strong> model, looks at reports f
                            rom the last <strong>100 days</strong>, follows up to <strong>25 links per website</strong>,
                            and does not filter by rivers. These settings work well for most users, but you can change as needed.
                        </p>
                    }
                />

                {/* Form panel for submitting FishTales data */}
                <FishTalesForm />
            </div>
        </main>
    );
}
