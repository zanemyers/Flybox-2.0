import { DocSection, ListBlock } from "@/client/components/docs";
import { serpDash, serpHome, serpSub } from "@/client/images/docs";

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

/* Text-only on purpose: the previous steps were screenshots of Google AI Studio,
   which no longer match anything a user will see. */
const openAiSteps = [
  {
    main: (
      <span>
        Go to{" "}
        <a className="link link-primary" href="https://platform.openai.com/signup" target="_blank" rel="noopener noreferrer">
          platform.openai.com
        </a>{" "}
        and sign in, or create an account.
      </span>
    ),
  },
  {
    main: (
      <span>
        Open{" "}
        <a className="link link-primary" href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer">
          API keys
        </a>{" "}
        from the dashboard sidebar.
      </span>
    ),
  },
  {
    main: (
      <span>
        Click <code>Create new secret key</code>, give it a name such as <code>flybox</code>, and create it.
      </span>
    ),
    noteLabel: "Note",
    note: "The key is shown once. Copy it before closing the dialog — you cannot view it again afterwards.",
  },
  {
    main: (
      <span>
        Add credit under{" "}
        <a className="link link-primary" href="https://platform.openai.com/settings/organization/billing/overview" target="_blank" rel="noopener noreferrer">
          Billing
        </a>
        . The API is not covered by a ChatGPT subscription and will return a quota error without it.
      </span>
    ),
    noteLabel: "Tip",
    note: "Set a monthly usage limit at the same time. A Flybox run summarizes once, so the cost per run is a fraction of a cent.",
  },
  {
    main: "Paste the key into the OpenAI API Key field in Flybox.",
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

export function OpenAiDoc() {
  return (
    <>
      <h1>OpenAI API</h1>
      <p className="prose-measure mt-3">
        Flybox uses <strong>OpenAI</strong> to summarize fishing reports. You&apos;ll need an API key with billing enabled to run Flybox.
      </p>
      <hr />
      <DocSection title="Get Your OpenAI API Key">
        <ListBlock items={openAiSteps} ordered />
      </DocSection>
    </>
  );
}
