import { DocSection, ListBlock } from "@/client/components/docs";
import { gaiApi, gaiHome, gaiKey, gaiLogin, gaiTerms, serpDash, serpHome, serpSub } from "@/client/images/docs";

const serpSteps = [
  {
    main: (
      <p>
        Go to{" "}
        <a className="link-external" href="https://serpapi.com/" target="_blank" rel="noopener noreferrer">
          SerpApi
        </a>{" "}
        and create an account
      </p>
    ),
    img: serpHome,
    alt: "SerpAPI App",
  },
  {
    main: "Verify your email and phone number to set up a free account.",
    img: serpSub,
    alt: "SerpAPI Subscription",
  },
  {
    main: (
      <p>
        Your API key is automatically generated. Copy the section called <code>Your Private API Key</code> to use in Flybox.
      </p>
    ),
    img: serpDash,
    alt: "Your Private API Key",
  },
];

const geminiSteps = [
  {
    main: (
      <p>
        Go to{" "}
        <a className="link-external" href="https://ai.google.dev/aistudio" target="_blank" rel="noopener noreferrer">
          ai.google.dev
        </a>{" "}
        and sign in with your Google account.
      </p>
    ),
    img: gaiLogin,
    alt: "Login",
  },
  {
    main: "First-time users will see a welcome message; otherwise, click `Get API key`.",
    img: gaiHome,
    alt: "Dashboard",
  },
  {
    main: "Accept the terms and conditions (first-time users only), then click `I accept`.",
    img: gaiTerms,
    alt: "Terms",
  },
  {
    main: "Click `+ Create API key` or select an existing key.",
    img: gaiApi,
    alt: "API Keys",
  },
  {
    main: "Copy your API key and keep it safe.",
    img: gaiKey,
    alt: "API Key",
  },
];

export function SerpApiDoc() {
  return (
    <>
      <h1 className="text-4xl font-semibold pb-3">🔑 SerpAPI</h1>
      <p>
        SerpAPI lets Flybox search <strong>Google Maps</strong> for fly-fishing shops. You'll need a free API key to run Flybox.
      </p>
      <hr className="my-6" />
      <DocSection title="Get Your SerpAPI Key">
        <ListBlock items={serpSteps} ordered={true} />
      </DocSection>
    </>
  );
}

export function GeminiApiDoc() {
  return (
    <>
      <h1 className="text-4xl font-semibold pb-3">✨ Gemini API</h1>
      <p>
        Flybox uses <strong>Google Gemini</strong> to summarize fishing reports. You'll need a free API key to run Flybox.
      </p>
      <hr className="my-6" />
      <DocSection title="Get Your Gemini API Key">
        <ListBlock items={geminiSteps} ordered={true} />
      </DocSection>
    </>
  );
}
