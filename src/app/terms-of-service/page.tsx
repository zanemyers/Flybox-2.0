import type { Metadata } from "next";
import { Clause, GithubIssues, LegalPage } from "@/client/components/legalPage";

export const metadata: Metadata = {
  title: "Terms of Service — Flybox",
  description: "Terms of service for Flybox.",
};

export default function TermsOfService() {
  return (
    <LegalPage title="Terms of Service" updated="April 11, 2026">
      <p>
        Welcome to Flybox. By accessing or using this website, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do
        not use the site.
      </p>

      <Clause heading="Description of the Service">
        <p>
          Flybox is a web-based service that collects and aggregates publicly available information about fly-fishing-related businesses and fishing reports,
          and summarizes them using AI.
        </p>
        <p>This includes:</p>
        <ul>
          <li>Business listings and metadata retrieved from Google Maps via third-party APIs (such as SerpAPI).</li>
          <li>Publicly available information from business websites, including contact details and fishing reports.</li>
          <li>AI-generated summaries of fishing report content produced via OpenAI.</li>
        </ul>
        <p>Flybox does not guarantee the accuracy, completeness, or timeliness of any information displayed.</p>
      </Clause>

      <Clause heading="API Keys and Third-Party Costs">
        <p>
          Flybox encourages users to provide their own API keys for SerpAPI and OpenAI to stay in control of their usage limits and any associated costs. Flybox
          is not responsible for any charges incurred through your use of third-party APIs.
        </p>
      </Clause>

      <Clause heading="Use of the Service">
        <p>You agree to use Flybox only for lawful purposes and in compliance with all applicable laws and regulations.</p>
        <p>You may not use this service to:</p>
        <ul>
          <li>Violate any applicable laws or regulations.</li>
          <li>Scrape, harvest, or reuse Flybox data at scale.</li>
          <li>Attempt to interfere with the operation or security of the site.</li>
        </ul>
      </Clause>

      <Clause heading="Data Sources and Third-Party Services">
        <p>
          Flybox relies on third-party data providers including SerpAPI and OpenAI, as well as publicly accessible websites. We are not affiliated with Google,
          SerpAPI, or any listed businesses.
        </p>
        <p>All trademarks, business names, and logos remain the property of their respective owners.</p>
      </Clause>

      <Clause heading="Intellectual Property">
        <p>
          The Flybox website, design, and original content are the intellectual property of Flybox unless otherwise stated. Aggregated business information
          remains the property of the original source or business owner.
        </p>
      </Clause>

      <Clause heading="Limitation of Liability">
        <p>
          Flybox is provided &quot;as is&quot; and &quot;as available&quot; without warranties of any kind. In no event shall Flybox be liable for any direct,
          indirect, incidental, or consequential damages arising from the use or inability to use the service.
        </p>
      </Clause>

      <Clause heading="Changes to These Terms">
        <p>
          We reserve the right to modify these Terms of Service at any time. Changes will be effective immediately upon posting. Your continued use of Flybox
          after changes are posted constitutes acceptance of the updated terms.
        </p>
      </Clause>

      <Clause heading="Contact">
        <p>
          If you have questions about these Terms of Service, please open an issue on our <GithubIssues />.
        </p>
      </Clause>
    </LegalPage>
  );
}
