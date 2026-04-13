import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Docs — Flybox",
  description:
    "Documentation for Flybox, including setup guides for SerpAPI and Google Gemini.",
};

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
