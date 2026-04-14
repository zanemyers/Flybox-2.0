import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — Flybox",
  description: "Terms of service for Flybox.",
};

export default function TermsOfService() {
  return (
    <div className="flex justify-center px-4 py-10">
      <div className="w-full max-w-4xl card-light">
        <div className="card-body">
          <article className="prose max-w-none">
            <h3>Terms of Service</h3>

            <p>
              <strong>Last updated:</strong> April 11, 2026
            </p>

            <br />

            <p>
              Welcome to Flybox. By accessing or using this website, you agree to be bound by these Terms of Service. If
              you do not agree to these terms, please do not use the site.
            </p>

            <br />

            <h5 className="footer-title">Description of the Service</h5>
            <p>
              Flybox is a web-based service that collects and aggregates publicly available information about
              fly-fishing-related businesses and fishing reports, and summarizes them using AI.
            </p>

            <p>This includes:</p>

            <ul>
              <li>Business listings and metadata retrieved from Google Maps via third-party APIs (such as SerpAPI).</li>
              <li>
                Publicly available information from business websites, including contact details and fishing reports.
              </li>
              <li>AI-generated summaries of fishing report content produced via Google Gemini.</li>
            </ul>

            <p className="pt-1">
              Flybox does not guarantee the accuracy, completeness, or timeliness of any information displayed.
            </p>

            <br />

            <h5 className="footer-title">API Keys and Third-Party Costs</h5>
            <p>
              Flybox encourages users to provide their own API keys for SerpAPI and Google Gemini to stay in control of
              their usage limits and any associated costs. Flybox is not responsible for any charges incurred through
              your use of third-party APIs.
            </p>

            <br />

            <h5 className="footer-title">Use of the Service</h5>
            <p>
              You agree to use Flybox only for lawful purposes and in compliance with all applicable laws and
              regulations.
            </p>

            <p>You may not use this service to:</p>

            <ul>
              <li>Violate any applicable laws or regulations.</li>
              <li>Scrape, harvest, or reuse Flybox data at scale.</li>
              <li>Attempt to interfere with the operation or security of the site.</li>
            </ul>

            <br />

            <h5 className="footer-title">Data Sources and Third-Party Services</h5>
            <p>
              Flybox relies on third-party data providers including SerpAPI and Google Gemini, as well as publicly
              accessible websites. We are not affiliated with Google, SerpAPI, or any listed businesses.
            </p>

            <p className="pt-1">
              All trademarks, business names, and logos remain the property of their respective owners.
            </p>

            <br />

            <h5 className="footer-title">Intellectual Property</h5>
            <p>
              The Flybox website, design, and original content are the intellectual property of Flybox unless otherwise
              stated. Aggregated business information remains the property of the original source or business owner.
            </p>

            <br />

            <h5 className="footer-title">Limitation of Liability</h5>
            <p>
              Flybox is provided "as is" and "as available" without warranties of any kind. In no event shall Flybox be
              liable for any direct, indirect, incidental, or consequential damages arising from the use or inability to
              use the service.
            </p>

            <br />

            <h5 className="footer-title">Changes to These Terms</h5>
            <p>
              We reserve the right to modify these Terms of Service at any time. Changes will be effective immediately
              upon posting. Your continued use of Flybox after changes are posted constitutes acceptance of the updated
              terms.
            </p>

            <br />

            <h5 className="footer-title">Contact</h5>
            <p>
              If you have questions about these Terms of Service, please open an issue on our{" "}
              <a className="link-external" href="https://github.com/zanemyers/Flybox-2.0/issues">
                GitHub repository
              </a>
              .
            </p>
          </article>
        </div>
      </div>
    </div>
  );
}
