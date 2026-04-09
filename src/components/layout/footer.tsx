import Link from "next/link";
import {Linkedin, Globe, Facebook, Instagram } from 'lucide-react';


const socialLinks = [
    { name: "Website", href: "https://rescueriver.com/", icon: Globe },
    { name: "LinkedIn", href: "https://www.linkedin.com/company/rescue-river/", icon: Linkedin },
    { name: "Facebook", href: "https://www.facebook.com/rescueriver", icon: Facebook },
    { name: "Instagram", href: "https://instagram.com/rescueriver8", icon: Instagram },
];

export default function Footer() {
    return (
        <footer className="bg-base-200 border-t border-base-300">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Top section: Connect */}
                <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                    <p className="text-base-content/70 text-center md:text-left">
                        Built with ❤️ for the Rescue River team.
                    </p>

                    <div className="flex gap-4 md:gap-6">
                        {socialLinks.map(({ name, href, icon: Icon }) => (
                            <a
                                key={name}
                                href={href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-base-content/70 transition-colors p-2 rounded-full hover:bg-primary hover:text-primary-content"
                                aria-label={name}
                            >
                                <Icon size={20} />
                            </a>
                        ))}
                    </div>
                </div>

                {/* Bottom section: Copyright & Links */}
                <div className="mt-8 pt-8 border-t border-base-300 flex flex-col md:flex-row justify-between items-center gap-4">
                    <p className="text-base-content/70 text-sm">
                        © 2025 Zane Myers. All rights reserved.
                    </p>

                    <div className="flex gap-6 text-sm">
                        <Link href="/privacy-policy" className="text-base-content/70 hover:text-base-content transition-colors">
                            Privacy Policy
                        </Link>
                        <Link href="/terms-of-service" className="text-base-content/70 hover:text-base-content transition-colors">
                            Terms of Service
                        </Link>
                    </div>
                </div>
            </div>
        </footer>
    );
}
