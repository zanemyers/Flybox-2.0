import type { Metadata } from "next";
import Link from "next/link";
import FlyboxForm from "@/client/components/flyboxForm";

export const metadata: Metadata = {
  title: "Flybox — Fly Fishing Report Tool",
  description: "Find local fly fishing shops, scrape their fishing reports, and get an AI-powered summary for any location.",
};

const steps = [
  {
    icon: "🔑",
    text: (
      <p>
        Enter your <strong>SerpAPI</strong> and <strong>Gemini API</strong> keys — don&apos;t have them? See the{" "}
        <a className="link-hash" href="/docs">
          Docs
        </a>
      </p>
    ),
  },
  {
    icon: "🔎",
    text: (
      <p>
        Enter a <strong>search term</strong> and pick a <strong>location</strong> on the map
      </p>
    ),
  },
  {
    icon: "🎣",
    text: (
      <p>
        Optionally filter results by <strong>river name</strong> — add as many as you like
      </p>
    ),
  },
  {
    icon: "▶️",
    text: (
      <p>
        Click <strong>Run Flybox</strong> — sit back while the pipeline runs
      </p>
    ),
  },
  {
    icon: "📥",
    text: (
      <p>
        Your <strong>report summary</strong> and <strong>shop directory</strong> will automatically download when ready
      </p>
    ),
  },
];

export default function Home() {
  const serpApiKey = process.env.SERP_API_KEY ?? "";
  const geminiApiKey = process.env.GEMINI_API_KEY ?? "";

  return (
    <main className="app-container">
      <div className="app-content">
        <div className="app-panel">
          <div className="card text-primary h-full flex flex-col">
            <div className="card-body flex-1 flex flex-col">
              <div className="space-y-3">
                <h3>🛠️ What This Tool Does</h3>
                <p>
                  Get a <strong>fly-fishing report summary</strong> and <strong>shop directory</strong> for any location — automatically. Flybox finds local
                  shops, identifies which ones publish fishing reports, and summarizes them with <strong>Google Gemini</strong>.
                </p>

                <h4>📋 How to Use It</h4>
                <div>
                  {steps.map((step, _i) => (
                    <div key={step.icon} className="icon-list">
                      <span className="icon-list__icon">{step.icon}</span>
                      {step.text}
                    </div>
                  ))}
                  <p className="ps-2 pt-1 text-sm text-base-content/80">
                    For more detailed instructions, see the{" "}
                    <Link className="link-hash" href="/docs?tab=Flybox">
                      Flybox documentation
                    </Link>
                    .
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
        <FlyboxForm defaultSerpApiKey={serpApiKey} defaultGeminiApiKey={geminiApiKey} />
      </div>
      <div className="mt-6 flex flex-col items-center gap-1 text-xs text-base-content/70">
        <p>
          <span className="mr-1">
            ⚠️ <strong>Warning:</strong>
          </span>
          Heavy usage may incur costs — use your own API keys to stay in control of your limits.
        </p>
        <p>
          <span className="mr-1">
            🔒 <strong>Privacy Notice:</strong>
          </span>
          Your API keys are never stored. Output files are retained temporarily to facilitate downloads.
        </p>
      </div>
    </main>
  );
}
