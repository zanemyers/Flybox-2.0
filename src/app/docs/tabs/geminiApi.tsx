import { DocSection, ListBlock } from "@/client/components/docs";
import {
  gaiApi,
  gaiHome,
  gaiKey,
  gaiLogin,
  gaiTerms,
} from "@/client/images/docs";

const geminiListItems = [
  {
    main: (
      <p>
        Go to{" "}
        <a
          className="link-external"
          href="https://ai.google.dev/aistudio"
          target="_blank"
          rel="noopener noreferrer"
        >
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

export default function GeminiApiDoc() {
  return (
    <>
      <h1 className="text-4xl font-semibold pb-3">✨ Gemini API</h1>
      <p>
        Flybox uses <strong>Google Gemini</strong> to summarize fishing reports.
        You'll need a free API key to run Flybox.
      </p>

      <hr className="my-6" />

      <DocSection title="Get Your Gemini API Key">
        <ListBlock items={geminiListItems} ordered={true} />
      </DocSection>
    </>
  );
}
