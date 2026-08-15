import { DocSection, ListBlock } from "@/client/components/docs";
import { gaiApi, gaiHome, gaiKey, gaiLogin, gaiTerms, serpDash, serpHome, serpSub } from "@/client/images/docs";

const serpSteps = [
  {
    main: (
      <span>
        Go to{" "}
        <a className="link link-primary" href="https://serpapi.com/" target="_blank" rel="noopener noreferrer">
          SerpApi
        </a>{" "}
        and create an account.
      </span>
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
      <span>
        Your API key is automatically generated. Copy the section called <code>Your Private API Key</code> to use in Flybox.
      </span>
    ),
    img: serpDash,
    alt: "Your Private API Key",
  },
];

const geminiSteps = [
  {
    main: (
      <span>
        Go to{" "}
        <a className="link link-primary" href="https://ai.google.dev/aistudio" target="_blank" rel="noopener noreferrer">
          ai.google.dev
        </a>{" "}
        and sign in with your Google account.
      </span>
    ),
    img: gaiLogin,
    alt: "Login",
  },
  {
    main: (
      <span>
        First-time users will see a welcome message; otherwise, click <code>Get API key</code>.
      </span>
    ),
    img: gaiHome,
    alt: "Dashboard",
  },
  {
    main: (
      <span>
        Accept the terms and conditions (first-time users only), then click <code>I accept</code>.
      </span>
    ),
    img: gaiTerms,
    alt: "Terms",
  },
  {
    main: (
      <span>
        Click <code>+ Create API key</code> or select an existing key.
      </span>
    ),
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
      <h1>SerpAPI</h1>
      <p className="prose-measure mt-3">
        SerpAPI lets Flybox search <strong>Google Maps</strong> for fly-fishing shops. You&apos;ll need a free API key to run Flybox.
      </p>
      <hr />
      <DocSection title="Get Your SerpAPI Key">
        <ListBlock items={serpSteps} ordered />
      </DocSection>
    </>
  );
}

export function GeminiApiDoc() {
  return (
    <>
      <h1>Gemini API</h1>
      <p className="prose-measure mt-3">
        Flybox uses <strong>Google Gemini</strong> to summarize fishing reports. You&apos;ll need a free API key to run Flybox.
      </p>
      <hr />
      <DocSection title="Get Your Gemini API Key">
        <ListBlock items={geminiSteps} ordered />
      </DocSection>
    </>
  );
}
