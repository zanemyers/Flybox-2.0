export default function PrivacyPolicy() {
    return (
        <div className="flex justify-center px-4 py-10">
            <div className="w-full max-w-4xl card-light">
                <div className="card-body">
                    <article className="prose max-w-none">
                        <h3>Privacy Policy</h3>

                        <p>
                            <strong>Last updated:</strong>{" "}
                            {new Date().toLocaleDateString()}
                        </p>

                        <br />

                        <p>
                            Flybox values your privacy. This Privacy Policy explains what
                            information we collect, how we use it, and your rights regarding
                            that information.
                        </p>

                        <br />

                        <h5 className="footer-title">Information We Collect</h5>

                        <p>
                            Flybox does not require users to create an account or provide
                            personal information to use the website.
                        </p>

                        <p>
                            We may collect limited, non-identifying information automatically,
                            such as:
                        </p>

                        <ul>
                            <li>Browser type</li>
                            <li>Device type</li>
                            <li>General usage data (pages visited, approximate location)</li>
                        </ul>

                        <p className="pt-1">
                            This information is used solely to understand site usage and
                            improve the service.
                        </p>

                        <br />

                        <h5 className="footer-title">Business and Public Data</h5>
                        <p>
                            Flybox collects and displays publicly available information about
                            fly-fishing-related businesses.
                        </p>

                        <p>This may include:</p>

                        <ul>
                            <li>Business names and locations</li>
                            <li>Contact information published on business websites</li>
                            <li>Fishing reports or other public content</li>
                            <li>Business metadata obtained via third-party services</li>
                        </ul>

                        <p className="pt-1">
                            This information is sourced from publicly accessible websites and
                            third-party APIs (such as SerpAPI). Flybox does not collect private
                            or confidential information.
                        </p>

                        <br />

                        <h5 className="footer-title">Use of Third-Party Services</h5>
                        <p>
                            Flybox relies on third-party tools and services to collect and
                            display information.
                        </p>

                        <p className="pt-1">
                            These services may have their own privacy policies and terms.
                            Flybox is not responsible for the privacy practices of third-party
                            services or external websites.
                        </p>

                        <br />

                        <h5 className="footer-title">Cookies</h5>
                        <p>
                            Flybox may use cookies or similar technologies to support basic
                            site functionality and analytics.
                        </p>

                        <p className="pt-1">
                            You can control or disable cookies through your browser settings.
                        </p>

                        <br />

                        <h5 className="footer-title">Data Accuracy and Updates</h5>
                        <p>
                            Flybox does not guarantee that business information displayed on
                            the site is accurate or up to date.
                        </p>

                        <p className="pt-1">
                            Businesses are encouraged to verify information through their own
                            official channels.
                        </p>

                        <br />

                        <h5 className="footer-title">Data Removal Requests</h5>
                        <p>
                            If you are a business owner and believe information displayed on
                            Flybox is inaccurate or should be removed, you may request review
                            or removal.
                        </p>

                        <p className="pt-1">
                            Requests can be submitted through the Flybox website and will be
                            evaluated on a case-by-case basis.
                        </p>

                        <br />

                        <h5 className="footer-title">Personal Privacy</h5>
                        <p>
                            Flybox does not knowingly collect, store, or process any personal information
                            from anyone.
                        </p>

                        <br />

                        <h5 className="footer-title">Changes to This Policy</h5>
                        <p>
                            We may update this Privacy Policy from time to time. Any changes
                            will be posted on this page with an updated effective date.
                        </p>

                        <p className="pt-1">
                            Continued use of the website after changes are posted constitutes
                            acceptance of the updated policy.
                        </p>

                        <br />

                        <h5 className="footer-title">Contact</h5>
                        <p>
                            If you have questions about this Privacy Policy or Flybox’s data
                            practices, please contact us through the Flybox website.
                        </p>
                    </article>
                </div>
            </div>
        </div>
    );
}
