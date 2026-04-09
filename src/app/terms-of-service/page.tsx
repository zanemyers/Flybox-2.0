export default function TermsOfService() {
    return (
        <div className="flex justify-center px-4 py-10">
            <div className="card w-full max-w-4xl bg-base-200 border border-base-300 shadow-xl">
                <div className="card-body">
                    <article className="prose max-w-none">
                        <h3>Terms of Service</h3>

                        <p>
                            <strong>Last updated:</strong> {new Date().toLocaleDateString()}
                        </p>

                        <br/>

                        <p>
                            Welcome to Flybox. By accessing or using this website, you agree to
                            be bound by these Terms of Service. If you do not agree to these
                            terms, please do not use the site.
                        </p>

                        <br />

                        <h5 className="footer-title">Description of the Service</h5>
                        <p>
                            Flybox is a web-based service that collects and aggregates publicly
                            available information about fly-fishing-related businesses.
                        </p>

                        <p>
                            This includes:
                        </p>

                        <ul>
                            <li>
                                Business listings and metadata retrieved from Google Maps via
                                third-party APIs (such as SerpAPI).
                            </li>
                            <li>
                                Publicly available information from business websites, including
                                contact details and fishing reports.
                            </li>
                        </ul>

                        <p className="pt-1">
                            Flybox does not guarantee the accuracy, completeness, or timeliness
                            of any information displayed.
                        </p>

                        <br />

                        <h5 className="footer-title">Use of the Service</h5>
                        <p>
                            You agree to use Flybox only for lawful purposes and in compliance
                            with all applicable laws and regulations.
                        </p>

                        <p>
                            You may not use this service to:
                        </p>

                        <ul>
                            <li>Violate any applicable laws or regulations.</li>
                            <li>Scrape, harvest, or reuse Flybox data at scale.</li>
                            <li>Attempt to interfere with the operation or security of the site.</li>
                        </ul>

                        <br />

                        <h5 className="footer-title">Data Sources and Third-Party Services</h5>
                        <p>
                            Flybox relies on third-party data providers and publicly accessible
                            websites. We are not affiliated with Google, SerpAPI, or any listed
                            businesses.
                        </p>

                        <p className="pt-1">
                            All trademarks, business names, and logos remain the property of
                            their respective owners.
                        </p>

                        <br />

                        <h5 className="footer-title">Intellectual Property</h5>
                        <p>
                            The Flybox website, design, and original content are the
                            intellectual property of Flybox unless otherwise stated.
                        </p>

                        <p className="pt-1">
                            Aggregated business information remains the property of the
                            original source or business owner.
                        </p>

                        <br />

                        <h5 className="footer-title">Limitation of Liability</h5>
                        <p>
                            Flybox is provided “as is” and “as available” without warranties of
                            any kind.
                        </p>

                        <p className="pt-1">
                            In no event shall Flybox be liable for any direct, indirect,
                            incidental, or consequential damages arising from the use or
                            inability to use the service.
                        </p>

                        <br />

                        <h5 className="footer-title">Changes to These Terms</h5>
                        <p>
                            We reserve the right to modify these Terms of Service at any time.
                            Changes will be effective immediately upon posting.
                        </p>

                        <p className="pt-1">
                            Your continued use of Flybox after changes are posted constitutes
                            acceptance of the updated terms.
                        </p>

                        <br />

                        <h5 className="footer-title">Contact</h5>
                        <p>
                            If you have questions about these Terms of Service, please contact
                            us through the Flybox website.
                        </p>
                    </article>
                </div>
            </div>
        </div>
    );
}